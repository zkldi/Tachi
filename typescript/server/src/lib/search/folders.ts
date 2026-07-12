import type { Game } from "tachi-db";

import { LoadFolderDocumentsByIds } from "#lib/db-formats/folders";
import { SHORT_QUERY_LEN, SHORT_QUERY_STRICT_MAX_LEN } from "#lib/search/songs";
import { AllEnabledGames } from "#lib/setup/config";
import DB from "#services/pg/db";
import { EscapeForILIKE } from "#utils/misc";
import { sql } from "kysely";
import { type FolderDocument, type integer, type V3Game } from "tachi-common";

type FolderSearchRow = {
	id: string;
	rank: number;
};

function gameFilterSql(allowedV3Games: Array<Game> | null) {
	if (allowedV3Games === null) {
		return sql``;
	}

	if (allowedV3Games.length === 0) {
		return sql`AND false`;
	}

	return sql`AND f.game IN (${sql.join(allowedV3Games.map((g) => sql`${g}`))})`;
}

async function finalizeFolderSearchRows(
	rows: Array<FolderSearchRow>,
): Promise<Array<{ __textScore: number } & FolderDocument>> {
	if (rows.length === 0) {
		return [];
	}

	const byIdMap = await LoadFolderDocumentsByIds(rows.map((r) => r.id));
	const out: Array<{ __textScore: number } & FolderDocument> = [];

	for (const r of rows) {
		const doc = byIdMap.get(r.id);

		if (doc) {
			out.push({ ...doc, __textScore: r.rank });
		}
	}

	return out;
}

async function searchFoldersFtsAndTrgmCore(
	search: string,
	opts: {
		games: Array<Game> | null;
		limit: integer;
		onlyActiveFolders: boolean;
	},
): Promise<Array<{ __textScore: number } & FolderDocument>> {
	const q = search.trim();

	if (q.length === 0) {
		return [];
	}

	const cap = Math.min(Math.max(1, opts.limit), 500);
	const inactiveSql = opts.onlyActiveFolders ? sql`AND f.inactive = false` : sql``;
	const v3FilterSql = gameFilterSql(opts.games);

	const folderTsvec = sql`(
			setweight(to_tsvector('simple', coalesce(f.title, '')), 'A') ||
			setweight(to_tsvector('simple', coalesce(array_to_string(f.search_terms, ' '), '')), 'B')
		)`;

	const { rows: ftsRows } = await sql<FolderSearchRow>`
		SELECT
			f.id,
			(ts_rank_cd(${folderTsvec}, websearch_to_tsquery('simple', ${q})))::float8 AS rank
		FROM folder f
		WHERE 1=1
			${v3FilterSql}
			${inactiveSql}
			AND ${folderTsvec} @@ websearch_to_tsquery('simple', ${q})
		ORDER BY rank DESC
		LIMIT ${cap}
	`.execute(DB);

	const strictShort = q.length <= SHORT_QUERY_STRICT_MAX_LEN;

	const exactRows = strictShort
		? (
				await sql<FolderSearchRow>`
				SELECT
					f.id,
					10.0::float8 AS rank
				FROM folder f
				WHERE 1=1
					${v3FilterSql}
					${inactiveSql}
					AND (
						lower(f.title) = lower(${q})
						OR EXISTS (
							SELECT 1
							FROM unnest(coalesce(f.search_terms, ARRAY[]::text[])) AS fst(term)
							WHERE lower(term) = lower(${q})
						)
					)
				LIMIT ${cap}
			`.execute(DB)
			).rows
		: [];

	const mergedBeforeTrgm = new Map<string, FolderSearchRow>();

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
		return finalizeFolderSearchRows(mergedList.slice(0, cap));
	}

	const excludeIds = mergedList.map((r) => r.id);
	const trgmLimit = cap - mergedList.length;
	const likeEsc = EscapeForILIKE(q.toLowerCase());
	const pat = `%${likeEsc}%`;

	const aggTermsSql = sql`array_to_string(f.search_terms, ' ')`;

	const { rows: trgmRows } =
		excludeIds.length === 0
			? await sql<FolderSearchRow>`
				SELECT
					f.id,
					GREATEST(
						similarity(lower(f.title), lower(${q})),
						similarity(lower(coalesce(${aggTermsSql}, '')), lower(${q}))
					)::float8 AS rank
				FROM folder f
				WHERE 1=1
					${v3FilterSql}
					${inactiveSql}
					AND (
						f.title ILIKE ${pat}
						OR EXISTS (
							SELECT 1
							FROM unnest(coalesce(f.search_terms, ARRAY[]::text[])) AS fst(term)
							WHERE term ILIKE ${pat}
						)
					)
				ORDER BY rank DESC
				LIMIT ${trgmLimit}
			`.execute(DB)
			: await sql<FolderSearchRow>`
				SELECT
					f.id,
					GREATEST(
						similarity(lower(f.title), lower(${q})),
						similarity(lower(coalesce(${aggTermsSql}, '')), lower(${q}))
					)::float8 AS rank
				FROM folder f
				WHERE 1=1
					${v3FilterSql}
					${inactiveSql}
					AND f.id NOT IN (${sql.join(excludeIds.map((id) => sql`${id}`))})
					AND (
						f.title ILIKE ${pat}
						OR EXISTS (
							SELECT 1
							FROM unnest(coalesce(f.search_terms, ARRAY[]::text[])) AS fst(term)
							WHERE term ILIKE ${pat}
						)
					)
				ORDER BY rank DESC
				LIMIT ${trgmLimit}
			`.execute(DB);

	const byId = new Map<string, FolderSearchRow>();

	for (const r of mergedList) {
		byId.set(r.id, r);
	}

	for (const r of trgmRows) {
		const existing = byId.get(r.id);

		if (!existing || r.rank > existing.rank) {
			byId.set(r.id, r);
		}
	}

	return finalizeFolderSearchRows(
		[...byId.values()].sort((a, b) => b.rank - a.rank).slice(0, cap),
	);
}

/**
 * Global folder search (`GET /api/v1/search`): same FTS + trgm strategy as
 * {@link SearchFoldersForGameFtsAndTrgm}, across all games (or restricted with the same
 * `game` + `playtype` `$in` semantics as the legacy Mongo filter).
 *
 * Inactive folders are included (legacy global search behavior).
 */
export function SearchFoldersFtsAndTrgmGlobal(
	search: string,
	opts: {
		games?: Array<V3Game>;
		limit?: integer;
	} = {},
): Promise<Array<{ __textScore: number } & FolderDocument>> {
	const limit = opts.limit ?? 500;

	return searchFoldersFtsAndTrgmCore(search, {
		limit,
		onlyActiveFolders: false,
		games: opts.games ?? AllEnabledGames(),
	});
}

/**
 * Folder search over Postgres `folder` (title + `search_terms` array): websearch FTS on title and
 * aggregated search terms, plus optional pg_trgm / ILIKE (same strategy as {@link SearchSongsForGameFtsAndTrgm}).
 *
 * @param onlyActiveFolders - When true, exclude rows with `inactive = true`. When false, include all.
 */
export function SearchFoldersForGameFtsAndTrgm(
	game: V3Game,
	search: string,
	opts: { limit: integer; onlyActiveFolders: boolean },
): Promise<Array<{ __textScore: number } & FolderDocument>> {
	return searchFoldersFtsAndTrgmCore(search, {
		limit: opts.limit,
		onlyActiveFolders: opts.onlyActiveFolders,
		games: [game],
	});
}
