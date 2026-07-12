import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_DeleteApiToken } from "./delete-api-token";
import { getApiToken, seedApiToken } from "./test-utils/api-tokens";

// ─── ACTION_DeleteApiToken ────────────────────────────────────────────────────

describe("ACTION_DeleteApiToken", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── 404 guard ─────────────────────────────────────────────────────────────

	it("throws 404 when the token does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_DeleteApiToken(taker, { token: "NONEXISTENT_TOKEN" }),
		).rejects.toMatchObject({ code: 404 });
	});

	it("throws 404 when the token belongs to another user", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedApiToken({ token: "OTHER_TOKEN", userId: other.id });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(ACTION_DeleteApiToken(taker, { token: "OTHER_TOKEN" })).rejects.toMatchObject({
			code: 404,
		});
	});

	it("writes a BAD action row when the token does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await expect(
			ACTION_DeleteApiToken(taker, { token: "NONEXISTENT_TOKEN" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "DELETE_API_TOKEN")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("returns {} on success", async () => {
		await seedApiToken({ token: "MY_TOKEN", userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		const result = await ACTION_DeleteApiToken(taker, { token: "MY_TOKEN" });

		expect(result).toEqual({});
	});

	it("removes the token from the DB", async () => {
		await seedApiToken({ token: "MY_TOKEN", userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiToken(taker, { token: "MY_TOKEN" });

		expect(await getApiToken("MY_TOKEN")).toBeUndefined();
	});

	// ── Isolation ─────────────────────────────────────────────────────────────

	it("does not delete other users' tokens", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedApiToken({ token: "OTHER_TOKEN", userId: other.id });
		await seedApiToken({ token: "MY_TOKEN", userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiToken(taker, { token: "MY_TOKEN" });

		expect(await getApiToken("OTHER_TOKEN")).toBeDefined();
	});

	it("does not delete other tokens belonging to the same user", async () => {
		await seedApiToken({ token: "MY_TOKEN", userId });
		await seedApiToken({ token: "MY_OTHER_TOKEN", userId });
		const taker = { ip: "127.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiToken(taker, { token: "MY_TOKEN" });

		expect(await getApiToken("MY_OTHER_TOKEN")).toBeDefined();
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		await seedApiToken({ token: "MY_TOKEN", userId });
		const taker = { ip: "10.0.0.1", acct: { id: userId, username } };

		await ACTION_DeleteApiToken(taker, { token: "MY_TOKEN" });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_API_TOKEN")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			kind: "DELETE_API_TOKEN",
			result: "GOOD",
			ip: "10.0.0.1",
			user_id: userId,
		});
	});
});
