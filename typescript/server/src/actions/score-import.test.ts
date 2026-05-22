import { RunScoreImportOnce } from "#lib/score-import/worker/run-score-import";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

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
	parserArguments: [
		{ scores: [], meta: { game: "iidx", playtype: "SP", service: "test" } },
	] as unknown as never,
} as const;

describe("RunScoreImportOnce – lock contention", () => {
	let importCounter = 0;
	function nextImportId() {
		return `import-rsi-lock-${++importCounter}`;
	}

	it("returns kind=lock_held when the user already has an active import lock", async () => {
		const { id: userID } = await seedUser({ username: "rsi_lock_held" });

		await lockUserImport(userID);

		const result = await RunScoreImportOnce({
			...IMPORT_INPUT,
			importID: nextImportId(),
			userID,
		});

		expect(result.kind).toBe("lock_held");
	});

	it("does NOT write an action row when lock is held", async () => {
		const { id: userID } = await seedUser({ username: "rsi_no_action_row" });

		await lockUserImport(userID);

		const importID = nextImportId();
		const before = await DB.selectFrom("action")
			.select((eb) => eb.fn.countAll<number>().as("n"))
			.where("action.kind", "=", "SCORE_IMPORT")
			.executeTakeFirstOrThrow();

		await RunScoreImportOnce({
			...IMPORT_INPUT,
			importID,
			userID,
		});

		const after = await DB.selectFrom("action")
			.select((eb) => eb.fn.countAll<number>().as("n"))
			.where("action.kind", "=", "SCORE_IMPORT")
			.executeTakeFirstOrThrow();

		expect(Number(after.n)).toBe(Number(before.n));
	});
});
