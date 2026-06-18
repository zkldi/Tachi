import type { GameGroup, ImportTypes, integer } from "tachi-common";

import DB from "#services/pg/db";

/**
 * Inserts the base `import` row at the start of a run so scores can reference `import_id` (FK on orphan_score, etc.).
 * Uses placeholder `time_finished` equal to `time_started`; {@link finalizeImportToPostgres} updates them.
 */
export async function ensureImportStub(
	importId: string,
	userId: integer,
	gameGroup: GameGroup,
	importType: ImportTypes,
	userIntent: boolean,
	service = "Unknown",
): Promise<void> {
	const now = new Date().toISOString();

	await DB.insertInto("import")
		.values({
			id: importId,
			user_id: userId,
			time_started: now,
			time_finished: now,
			game_group: gameGroup,
			import_type: importType,
			user_intent: userIntent,
			service,
			status: "in_progress",
		})
		.execute();
}

/**
 * Removes an in-progress import run: staged scores and the import stub (dependent rows cascade).
 */
export async function deleteImportRun(importId: string): Promise<void> {
	await DB.deleteFrom("raw_score as score")
		.where("score.import_id", "=", importId)
		.where("score.committed", "=", false)
		.execute();

	// import_* / import_timing / import_game rows cascade. orphan_score.import_id is set null (not deleted).
	await DB.deleteFrom("import").where("id", "=", importId).execute();
}

/**
 * Cleans up all uncommitted scores left over from crashed/stuck imports for a user.
 * Called at the start of every new import (after acquiring the lock) so that orphaned
 * committed=false rows from a previous crash never block re-importing or pollute PBs.
 *
 * Deletes via the `import` table first (in_progress stubs → their staged scores), then
 * sweeps directly for any remaining committed=false rows that have no matching import row.
 */
export async function cleanUpStaleImportsForUser(
	userId: integer,
	currentImportId: string,
): Promise<void> {
	const staleImports = await DB.selectFrom("import")
		.select("import.id")
		.where("import.user_id", "=", userId)
		.where("import.status", "=", "in_progress")
		.execute();

	for (const stale of staleImports) {
		if (stale.id !== currentImportId) {
			// eslint-disable-next-line no-await-in-loop
			await deleteImportRun(stale.id);
		}
	}

	// Safety net: delete any committed=false scores whose import row was already removed.
	await DB.deleteFrom("raw_score as score")
		.where("score.user_id", "=", userId)
		.where("score.committed", "=", false)
		.where("score.import_id", "!=", currentImportId)
		.execute();
}
