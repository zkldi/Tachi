import type { Game } from "tachi-db";

import DB from "#services/pg/db";
import { sql } from "kysely";

export interface ClaimedPbDirtyRow {
	user_id: number;
	chart_id: string;
	chart_game: Game;
}

export interface ClaimedSessionDirtyRow {
	session_id: string;
}

export interface ClaimedGameProfileDirtyRow {
	user_id: number;
	game: Game;
}

/**
 * Atomically claim `pb_dirty` rows for processing. Uses `FOR UPDATE SKIP LOCKED` so
 * concurrent drain workers never process the same pair.
 */
export function claimPbDirtyRows(limit: number): Promise<Array<ClaimedPbDirtyRow>> {
	return DB.transaction().execute(async (trx) => {
		const result = await sql<ClaimedPbDirtyRow>`
			WITH to_claim AS (
				SELECT d.user_id, d.chart_id, c.game AS chart_game
				FROM pb_dirty d
				INNER JOIN chart c ON c.id = d.chart_id
				ORDER BY d.enqueued_at ASC
				LIMIT ${limit}
				FOR UPDATE OF d SKIP LOCKED
			),
			deleted AS (
				DELETE FROM pb_dirty d
				USING to_claim t
				WHERE d.user_id = t.user_id
					AND d.chart_id = t.chart_id
				RETURNING d.user_id, d.chart_id, t.chart_game
			)
			SELECT user_id, chart_id, chart_game FROM deleted
		`.execute(trx);

		return result.rows;
	});
}

/** Atomically claim `session_dirty` rows (`FOR UPDATE SKIP LOCKED`). */
export function claimSessionDirtyRows(limit: number): Promise<Array<ClaimedSessionDirtyRow>> {
	return DB.transaction().execute(async (trx) => {
		const result = await sql<ClaimedSessionDirtyRow>`
			WITH to_claim AS (
				SELECT d.session_id
				FROM session_dirty d
				ORDER BY d.enqueued_at ASC
				LIMIT ${limit}
				FOR UPDATE OF d SKIP LOCKED
			),
			deleted AS (
				DELETE FROM session_dirty d
				USING to_claim t
				WHERE d.session_id = t.session_id
				RETURNING d.session_id
			)
			SELECT session_id FROM deleted
		`.execute(trx);

		return result.rows;
	});
}

/** Atomically claim `game_profile_dirty` rows (`FOR UPDATE SKIP LOCKED`). */
export function claimGameProfileDirtyRows(
	limit: number,
): Promise<Array<ClaimedGameProfileDirtyRow>> {
	return DB.transaction().execute(async (trx) => {
		const result = await sql<ClaimedGameProfileDirtyRow>`
			WITH to_claim AS (
				SELECT d.user_id, d.game
				FROM game_profile_dirty d
				ORDER BY d.enqueued_at ASC
				LIMIT ${limit}
				FOR UPDATE OF d SKIP LOCKED
			),
			deleted AS (
				DELETE FROM game_profile_dirty d
				USING to_claim t
				WHERE d.user_id = t.user_id
					AND d.game = t.game
				RETURNING d.user_id, d.game
			)
			SELECT user_id, game FROM deleted
		`.execute(trx);

		return result.rows;
	});
}
