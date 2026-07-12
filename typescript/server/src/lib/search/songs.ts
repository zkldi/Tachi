import DB from "#services/pg/db";
import { EscapeForILIKE } from "#utils/misc";
import { sql } from "kysely";
import { type GameGroup, type SongDocument, type SongDocumentData } from "tachi-common";

/** Hard cap on song hits per `game_group` (FTS + trgm combined). */
export const MAX_SONG_SEARCH_RESULTS_PER_GAME = 100;

/** Use trigram / ILIKE supplement when the query is this short or FTS returns nothing. */
export const SHORT_QUERY_LEN = 3;

/**
 * Queries this short match almost every row if we use substring `ILIKE '%q%'` / trgm.
 * For `len <=` this value we only add **exact** matches (title, artist, search_term, alt_title)
 * and skip substring trgm; FTS still runs first.
 */
export const SHORT_QUERY_STRICT_MAX_LEN = 2;

/**
 * IIDX-only: exclude songs whose **only** IIDX charts are 2dxtra (`data.2dxtraSet` set).
 * Songs with no `chart` rows yet, or with at least one non-2dxtra IIDX chart, stay searchable.
 */
function iidxSongSearchableWith2dxtraRuleSql(game: GameGroup) {
	if (game !== "iidx") {
		return sql`true`;
	}

	return sql`(
		NOT EXISTS (
			SELECT 1 FROM chart c
			WHERE c.song_id = song.id
				AND (c.game)::text LIKE 'iidx-%'
		)
		OR EXISTS (
			SELECT 1 FROM chart c
			WHERE c.song_id = song.id
				AND (c.game)::text LIKE 'iidx-%'
				AND (c.data->>'2dxtraSet') IS NULL
		)
	)`;
}

export type SongSearchRow = {
	artist: string;
	data: unknown;
	id: string;
	legacy_id: number;
	rank: number;
	title: string;
};

/**
 * Indexed song search: PostgreSQL FTS (tsvector) plus optional pg_trgm / ILIKE fallback
 * (Zenith-style - no full-table load, no huge IN lists).
 *
 * Queries with length ≤ {@link SHORT_QUERY_STRICT_MAX_LEN} also run an **exact** match pass
 * (title, artist, `search_terms`, `alt_titles`) with a boosted rank; substring
 * `ILIKE '%q%'` trgm is skipped so single-letter titles like “A” are findable without noise.
 */
export async function SearchSongsForGameFtsAndTrgm(
	game: GameGroup,
	search: string,
	limit: number,
): Promise<Array<SongSearchRow>> {
	const q = search.trim();

	if (q.length === 0) {
		return [];
	}

	const cap = Math.min(Math.max(1, limit), MAX_SONG_SEARCH_RESULTS_PER_GAME);

	const { rows: ftsRows } = await sql<SongSearchRow>`
		SELECT
			id,
			legacy_id,
			title,
			artist,
			data,
			(ts_rank_cd(textsearch, websearch_to_tsquery('simple', ${q})))::float8 AS rank
		FROM song
		WHERE game_group = ${game}
			AND ${iidxSongSearchableWith2dxtraRuleSql(game)}
			AND textsearch @@ websearch_to_tsquery('simple', ${q})
		ORDER BY rank DESC
		LIMIT ${cap}
	`.execute(DB);

	const strictShort = q.length <= SHORT_QUERY_STRICT_MAX_LEN;

	const exactRows = strictShort
		? (
				await sql<SongSearchRow>`
				SELECT
					song.id,
					song.legacy_id,
					song.title,
					song.artist,
					song.data,
					10.0::float8 AS rank
				FROM song
				WHERE song.game_group = ${game}
					AND ${iidxSongSearchableWith2dxtraRuleSql(game)}
					AND (
						lower(song.title) = lower(${q})
						OR lower(song.artist) = lower(${q})
						OR EXISTS (
							SELECT 1
							FROM unnest(song.search_terms) AS st(term)
							WHERE lower(term) = lower(${q})
						)
						OR EXISTS (
							SELECT 1
							FROM unnest(song.alt_titles) AS at(alt_title)
							WHERE lower(alt_title) = lower(${q})
						)
					)
				LIMIT ${cap}
			`.execute(DB)
			).rows
		: [];

	const mergedBeforeTrgm = new Map<string, SongSearchRow>();

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
		return mergedList.slice(0, cap);
	}

	const excludeIds = mergedList.map((r) => r.id);
	const trgmLimit = cap - mergedList.length;
	const likeEsc = EscapeForILIKE(q.toLowerCase());
	const pat = `%${likeEsc}%`;

	const { rows: trgmRows } =
		excludeIds.length === 0
			? await sql<SongSearchRow>`
				SELECT
					id,
					legacy_id,
					title,
					artist,
					data,
					GREATEST(
						similarity(lower(title), lower(${q})),
						similarity(lower(artist), lower(${q})),
						similarity(lower(fts_document), lower(${q}))
					)::float8 AS rank
				FROM song
				WHERE game_group = ${game}
					AND ${iidxSongSearchableWith2dxtraRuleSql(game)}
					AND (
						title ILIKE ${pat}
						OR artist ILIKE ${pat}
						OR fts_document ILIKE ${pat}
					)
				ORDER BY rank DESC
				LIMIT ${trgmLimit}
			`.execute(DB)
			: await sql<SongSearchRow>`
				SELECT
					id,
					legacy_id,
					title,
					artist,
					data,
					GREATEST(
						similarity(lower(title), lower(${q})),
						similarity(lower(artist), lower(${q})),
						similarity(lower(fts_document), lower(${q}))
					)::float8 AS rank
				FROM song
				WHERE game_group = ${game}
					AND ${iidxSongSearchableWith2dxtraRuleSql(game)}
					AND id NOT IN (${sql.join(excludeIds)})
					AND (
						title ILIKE ${pat}
						OR artist ILIKE ${pat}
						OR fts_document ILIKE ${pat}
					)
				ORDER BY rank DESC
				LIMIT ${trgmLimit}
			`.execute(DB);

	const byId = new Map<string, SongSearchRow>();

	for (const r of mergedList) {
		byId.set(r.id, r);
	}

	for (const r of trgmRows) {
		const existing = byId.get(r.id);

		if (!existing || r.rank > existing.rank) {
			byId.set(r.id, r);
		}
	}

	return [...byId.values()].sort((a, b) => b.rank - a.rank).slice(0, cap);
}

/**
 * Loads `search_terms` and `alt_titles` for a bounded set of song PKs (e.g. search hits).
 */
export async function LoadSongChildrenForPgIds(
	songIds: string[],
): Promise<Map<string, { altTitles: string[]; searchTerms: string[] }>> {
	if (songIds.length === 0) {
		return new Map();
	}

	const rows = await DB.selectFrom("song")
		.select(["id", "search_terms", "alt_titles"])
		.where("id", "in", songIds)
		.execute();

	const byId = new Map(rows.map((r) => [r.id, r] as const));

	const out = new Map<string, { altTitles: string[]; searchTerms: string[] }>();

	for (const id of songIds) {
		const row = byId.get(id);

		out.set(id, {
			searchTerms: row?.search_terms ?? [],
			altTitles: row?.alt_titles ?? [],
		});
	}

	return out;
}

export type SongSearchReturn = {
	__textScore: number;
} & SongDocument;

/**
 * Fuzzy song search over `song` metadata.
 */
export async function searchSpecificGameSongs(
	gameGroup: GameGroup,
	search: string,
	limit = 100,
): Promise<{
	songs: Array<SongSearchReturn>;
}> {
	const rows = await SearchSongsForGameFtsAndTrgm(gameGroup, search, limit);

	if (rows.length === 0) {
		return { songs: [] };
	}

	const children = await LoadSongChildrenForPgIds(rows.map((r) => r.id));

	const songs: Array<SongSearchReturn> = [];

	for (const row of rows) {
		const ch = children.get(row.id);

		songs.push({
			id: row.id,
			title: row.title,
			artist: row.artist,
			searchTerms: ch?.searchTerms ?? [],
			altTitles: ch?.altTitles ?? [],
			data: row.data as SongDocumentData[typeof gameGroup],
			__textScore: Math.round(1000 * row.rank),
		});
	}

	return { songs };
}

export async function SearchSpecificGameSongs(
	game: GameGroup,
	search: string,
	limit = 100,
): Promise<Array<SongSearchReturn>> {
	const { songs } = await searchSpecificGameSongs(game, search, limit);

	return songs;
}
