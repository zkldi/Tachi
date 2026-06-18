import type { Database } from "tachi-db";

import DB from "#services/pg/db";
import { type ExpressionBuilder, sql } from "kysely";

import { getActiveImportId } from "../import-run-context";

/**
 * SQL predicate for queries against `raw_score as score`: visible means committed,
 * or belonging to the currently active import run (staged scores).
 */
export function scoreVisiblePredicate(eb: ExpressionBuilder<Database, "score">) {
	const importId = getActiveImportId();

	if (importId === null) {
		return eb("score.committed", "=", true);
	}

	return sql<boolean>`(score.committed = true OR score.import_id = ${importId})`;
}

/**
 * Same as {@link scoreVisiblePredicate}, but as a standalone SQL fragment for queries
 * that join `raw_score as score` with other tables (Kysely's ExpressionBuilder table set differs).
 */
export function scoreVisibleSql() {
	const importId = getActiveImportId();

	if (importId === null) {
		return sql<boolean>`score.committed = true`;
	}

	return sql<boolean>`(score.committed = true OR score.import_id = ${importId})`;
}

/** Deletes all uncommitted scores for an import run (failed import cleanup). */
export async function deleteUncommittedScoresForImport(importId: string): Promise<void> {
	await DB.deleteFrom("raw_score as score")
		.where("score.import_id", "=", importId)
		.where("score.committed", "=", false)
		.execute();
}

/** Marks staged scores as committed after successful post-import steps. */
export async function commitScoresForImport(importId: string): Promise<void> {
	await DB.updateTable("raw_score as score")
		.set({ committed: true })
		.where("score.import_id", "=", importId)
		.where("score.committed", "=", false)
		.execute();
}
