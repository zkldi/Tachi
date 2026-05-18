import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

import { ACTION_ScoreImport } from "./score-import";

async function seedImportTracker(importID: string, userID: number) {
	await DB.insertInto("import_tracker")
		.values({
			import_id: importID,
			user_id: userID,
			import_type: "file/batch-manual" as never,
			user_intent: false,
			time_started: new Date().toISOString(),
			error: null,
		})
		.execute();
}

async function lockUserImport(userID: number) {
	await DB.insertInto("import_lock")
		.values({
			user_id: userID,
			locked: true,
			locked_at: new Date().toISOString(),
		})
		.onConflict((oc) =>
			oc.column("user_id").doUpdateSet({ locked: true, locked_at: new Date().toISOString() }),
		)
		.execute();
}

const IMPORT_INPUT = {
	importType: "file/batch-manual",
	userIntent: false,
	"!parserArguments": [
		{ scores: [], meta: { game: "iidx", playtype: "SP", service: "test" } },
	] as unknown[],
	skipStartTracking: true,
} as const satisfies Omit<Parameters<typeof ACTION_ScoreImport>[1], "importID">;

describe("ACTION_ScoreImport – omitImportTrackerFailureOn409", () => {
	let importCounter = 0;
	function nextImportId() {
		return `import-si-409-${++importCounter}`;
	}

	it("marks the tracker as failed when the user has an active import lock and flag is absent", async () => {
		const { id: userID, username } = await seedUser({ username: "si_409_default" });
		const importID = nextImportId();
		const taker = { ip: null, acct: { id: userID, username } };

		await lockUserImport(userID);
		await seedImportTracker(importID, userID);

		await expect(
			ACTION_ScoreImport(taker, { ...IMPORT_INPUT, importID }),
		).rejects.toMatchObject({ code: 409 });

		const tracker = await DB.selectFrom("import_tracker")
			.select(["import_tracker.error"])
			.where("import_tracker.import_id", "=", importID)
			.executeTakeFirst();

		// Tracker row should have had its error set.
		expect(tracker?.error).not.toBeNull();
	});

	it("does NOT mark the tracker as failed when the flag is true", async () => {
		const { id: userID, username } = await seedUser({ username: "si_409_omit" });
		const importID = nextImportId();
		const taker = { ip: null, acct: { id: userID, username } };

		await lockUserImport(userID);
		await seedImportTracker(importID, userID);

		await expect(
			ACTION_ScoreImport(taker, {
				...IMPORT_INPUT,
				importID,
				omitImportTrackerFailureOn409: true,
			}),
		).rejects.toMatchObject({ code: 409 });

		const tracker = await DB.selectFrom("import_tracker")
			.select(["import_tracker.error"])
			.where("import_tracker.import_id", "=", importID)
			.executeTakeFirst();

		// Tracker row should still have no error so the poller keeps waiting.
		expect(tracker?.error).toBeNull();
	});
});
