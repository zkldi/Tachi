import DB from "#services/pg/db";
import { sql } from "kysely";

/**
 * ISO timestamp captured when a stats calculation run begins. Upserts only apply when
 * {@link runStartedAt} is >= the row's existing `last_clean_started_at`.
 *
 * Uses Postgres `now()` so the guard compares against the same clock as `last_clean_started_at`.
 */
export type CalculationRunStartedAt = string;

export async function newCalculationRunStartedAt(): Promise<CalculationRunStartedAt> {
	const result = await sql<{ ts: CalculationRunStartedAt }>`select now() as ts`.execute(DB);
	return result.rows[0]!.ts;
}
