import type { ImportDocument } from "tachi-common";

import db from "#services/pg/db";
import { createTestAccount } from "#test-utils/db";
import { SELECT_ACTION } from "#test-utils/select-constants";
import { type ActionTaker, ExpectedErr } from "bliss";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_Sync } from "./sync";

// Auto-mock the api-requests module so no real HTTP calls are made.
vi.mock("../utils/api-requests");

const { PerformScoreImport } = await import("../utils/api-requests");

function makeImportDoc(overrides: Partial<ImportDocument> = {}): ImportDocument {
	return {
		importID: "import-abc-123",
		userID: 1,
		gameGroup: "iidx",
		games: ["iidx-sp"],
		scoreIDs: ["s1", "s2"],
		createdSessions: [{ sessionID: "sess1", type: "Created" }],
		errors: [],
		classDeltas: [],
		goalProgress: [],
		questProgress: [],
		...overrides,
	} as unknown as ImportDocument;
}

describe("ACTION_Sync", () => {
	let taker: ActionTaker;

	beforeEach(async () => {
		vi.clearAllMocks();
		const acct = await createTestAccount("syncuser", "sync-token-dddd");
		taker = { acct: { id: acct.id, username: acct.username }, ip: "10.0.0.1" };
	});

	const syncInput = { import_type: "api/flo-iidx", "!api_token": "sync-token-dddd" };

	it("returns a summary of the completed import", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue(makeImportDoc());

		const result = await ACTION_Sync(taker, syncInput);

		expect(result).toEqual({
			import_id: "import-abc-123",
			score_count: 2,
			session_count: 1,
			error_count: 0,
			user_id: 1,
			games: ["iidx-sp"],
		});
	});

	it("passes the api_token and import_type through to PerformScoreImport", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue(makeImportDoc());

		await ACTION_Sync(taker, { import_type: "api/eag-sdvx", "!api_token": "my-token" });

		expect(PerformScoreImport).toHaveBeenCalledWith("/import/from-api", "my-token", {
			importType: "api/eag-sdvx",
		});
	});

	it("strips api_token from the audit log input", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue(makeImportDoc());

		await ACTION_Sync(taker, syncInput);

		const action = await db
			.selectFrom("action")
			.select(SELECT_ACTION)
			.where("action.kind", "=", "SYNC")
			.executeTakeFirst();

		const input = action?.input as Record<string, unknown>;
		expect(input).not.toHaveProperty("!api_token");
		expect(input).toMatchObject({ import_type: "api/flo-iidx" });
	});

	it("throws ExpectedErr when PerformScoreImport returns an error string", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue(
			"Your API key has expired." as unknown as ImportDocument,
		);

		await expect(ACTION_Sync(taker, syncInput)).rejects.toMatchObject({
			code: 400,
			reason: "Your API key has expired.",
		});
	});

	it("the ExpectedErr thrown on failure is an ExpectedErr instance", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue(
			"Import failed." as unknown as ImportDocument,
		);

		await expect(ACTION_Sync(taker, syncInput)).rejects.toBeInstanceOf(ExpectedErr);
	});

	it("writes a GOOD action row for a successful import", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue(makeImportDoc());

		await ACTION_Sync(taker, syncInput);

		const action = await db
			.selectFrom("action")
			.select(SELECT_ACTION)
			.where("action.kind", "=", "SYNC")
			.executeTakeFirst();

		// node-pg returns BIGINT columns as strings
		expect(action).toMatchObject({
			app: "TACHI_BOT",
			kind: "SYNC",
			result: "GOOD",
			user_id: taker.acct.id,
		});
	});

	it("writes a BAD action row when PerformScoreImport returns an error string", async () => {
		vi.mocked(PerformScoreImport).mockResolvedValue("Bad import." as unknown as ImportDocument);

		await expect(ACTION_Sync(taker, syncInput)).rejects.toBeInstanceOf(ExpectedErr);

		const action = await db
			.selectFrom("action")
			.select(SELECT_ACTION)
			.where("action.kind", "=", "SYNC")
			.executeTakeFirst();

		expect(action?.result).toBe("BAD");
	});

	it("writes a THROW action row when PerformScoreImport throws", async () => {
		vi.mocked(PerformScoreImport).mockRejectedValue(new Error("Network error"));

		await expect(ACTION_Sync(taker, syncInput)).rejects.toThrow("Network error");

		const action = await db
			.selectFrom("action")
			.select(SELECT_ACTION)
			.where("action.kind", "=", "SYNC")
			.executeTakeFirst();

		expect(action?.result).toBe("THROW");
	});
});
