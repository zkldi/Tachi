import { type SELECT_SESSION_DOCUMENT, ToSessionDocument } from "#lib/db-formats/session";
import DB from "#services/pg/db";
import { EscapeForILIKE } from "#utils/misc";
import { GetScoreIdsGroupedBySessionId } from "#utils/queries/sessions";
import { type Selection, sql } from "kysely";
import { type integer, type SessionDocument } from "tachi-common";
import { type Database, type Game } from "tachi-db";

import { SHORT_QUERY_LEN, SHORT_QUERY_STRICT_MAX_LEN } from "./songs";

/** One ranked hit from session search (Postgres FTS + trgm). */
export type SearchSessionHit = {
	rank: number;
	session: SessionDocument;
};

/**
 * Row shape from raw SQL: `session` columns plus `rank` (see {@link SELECT_SESSION_DOCUMENT}).
 */
type SessionSearchPgRow = {
	rank: number;
} & Selection<Database, "session", (typeof SELECT_SESSION_DOCUMENT)[number]>;

function toSessionDocumentRow(
	row: SessionSearchPgRow,
): Selection<Database, "session", (typeof SELECT_SESSION_DOCUMENT)[number]> {
	const { rank: _rank, ...sessionFields } = row;

	return sessionFields;
}

async function finalizeHits(
	mergedRows: Array<SessionSearchPgRow>,
): Promise<Array<SearchSessionHit>> {
	if (mergedRows.length === 0) {
		return [];
	}

	const ids = mergedRows.map((r) => r.id);
	const scoreMap = await GetScoreIdsGroupedBySessionId(ids);

	return mergedRows.map((row) => ({
		rank: row.rank,
		session: ToSessionDocument(toSessionDocumentRow(row), scoreMap.get(row.id) ?? []),
	}));
}

/**
 * Search a user's sessions for one game: `websearch_to_tsquery` on `session.textsearch`, optional
 * short-query exact match, then pg_trgm / ILIKE - same strategy as
 * {@link SearchSongsForGameFtsAndTrgm} / {@link SearchFoldersForGameFtsAndTrgm}.
 *
 * Returns full {@link SessionDocument}s (no follow-up `WHERE id IN (...)` on `session`).
 */
export async function SearchSessionsForUserGptFtsAndTrgm(
	userId: integer,
	v3Game: Game,
	search: string,
	limit: number,
): Promise<Array<SearchSessionHit>> {
	const q = search.trim();

	if (q.length === 0) {
		return [];
	}

	const cap = Math.min(Math.max(1, limit), 500);

	const { rows: ftsRows } = await sql<SessionSearchPgRow>`
		SELECT
			s.id,
			s.user_id,
			s.game,
			s.name,
			s.description,
			s.time_inserted,
			s.time_started,
			s.time_ended,
			s.calculated_data,
			s.highlight,
			(ts_rank_cd(s.textsearch, websearch_to_tsquery('simple', ${q})))::float8 AS rank
		FROM session s
		WHERE s.user_id = ${userId}
			AND s.game = ${v3Game}
			AND s.textsearch @@ websearch_to_tsquery('simple', ${q})
		ORDER BY rank DESC
		LIMIT ${cap}
	`.execute(DB);

	const strictShort = q.length <= SHORT_QUERY_STRICT_MAX_LEN;

	const exactRows = strictShort
		? (
				await sql<SessionSearchPgRow>`
				SELECT
					s.id,
					s.user_id,
					s.game,
					s.name,
					s.description,
					s.time_inserted,
					s.time_started,
					s.time_ended,
					s.calculated_data,
					s.highlight,
					10.0::float8 AS rank
				FROM session s
				WHERE s.user_id = ${userId}
					AND s.game = ${v3Game}
					AND (
						lower(s.name) = lower(${q})
						OR (
							s.description IS NOT NULL
							AND lower(s.description) = lower(${q})
						)
					)
				LIMIT ${cap}
			`.execute(DB)
			).rows
		: [];

	const mergedBeforeTrgm = new Map<string, SessionSearchPgRow>();

	for (const r of ftsRows) {
		mergedBeforeTrgm.set(r.id, r);
	}

	for (const r of exactRows) {
		const existing = mergedBeforeTrgm.get(r.id);

		if (!existing || r.rank > existing.rank) {
			mergedBeforeTrgm.set(r.id, r);
		}
	}

	const mergedList = [...mergedBeforeTrgm.values()].sort((a, b) => b.rank - a.rank);

	const needTrgm =
		mergedList.length < cap &&
		!strictShort &&
		(q.length <= SHORT_QUERY_LEN || ftsRows.length === 0);

	if (!needTrgm) {
		return finalizeHits(mergedList.slice(0, cap));
	}

	const excludeIds = mergedList.map((r) => r.id);
	const trgmLimit = cap - mergedList.length;
	const likeEsc = EscapeForILIKE(q.toLowerCase());
	const pat = `%${likeEsc}%`;

	const { rows: trgmRows } =
		excludeIds.length === 0
			? await sql<SessionSearchPgRow>`
				SELECT
					s.id,
					s.user_id,
					s.game,
					s.name,
					s.description,
					s.time_inserted,
					s.time_started,
					s.time_ended,
					s.calculated_data,
					s.highlight,
					GREATEST(
						similarity(lower(s.name), lower(${q})),
						similarity(lower(coalesce(s.description, '')), lower(${q}))
					)::float8 AS rank
				FROM session s
				WHERE s.user_id = ${userId}
					AND s.game = ${v3Game}
					AND (
						s.name ILIKE ${pat}
						OR (s.description IS NOT NULL AND s.description ILIKE ${pat})
					)
				ORDER BY rank DESC
				LIMIT ${trgmLimit}
			`.execute(DB)
			: await sql<SessionSearchPgRow>`
				SELECT
					s.id,
					s.user_id,
					s.game,
					s.name,
					s.description,
					s.time_inserted,
					s.time_started,
					s.time_ended,
					s.calculated_data,
					s.highlight,
					GREATEST(
						similarity(lower(s.name), lower(${q})),
						similarity(lower(coalesce(s.description, '')), lower(${q}))
					)::float8 AS rank
				FROM session s
				WHERE s.user_id = ${userId}
					AND s.game = ${v3Game}
					AND s.id NOT IN (${sql.join(excludeIds.map((id) => sql`${id}`))})
					AND (
						s.name ILIKE ${pat}
						OR (s.description IS NOT NULL AND s.description ILIKE ${pat})
					)
				ORDER BY rank DESC
				LIMIT ${trgmLimit}
			`.execute(DB);

	const byId = new Map<string, SessionSearchPgRow>();

	for (const r of mergedList) {
		byId.set(r.id, r);
	}

	for (const r of trgmRows) {
		const existing = byId.get(r.id);

		if (!existing || r.rank > existing.rank) {
			byId.set(r.id, r);
		}
	}

	const merged = [...byId.values()].sort((a, b) => b.rank - a.rank).slice(0, cap);

	return finalizeHits(merged);
}
