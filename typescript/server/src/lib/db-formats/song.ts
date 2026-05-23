import type { GameGroup, SEEDS_SongDocument, SongDocument, SongDocumentData } from "tachi-common";

import DB from "#services/pg/db";
import { type Selection } from "kysely";
import { type Database } from "tachi-db";

export const SELECT_SONG_DOCUMENT = [
	"song.id as song_id",
	"song.title as song_title",
	"song.artist as song_artist",
	"song.search_terms as song_search_terms",
	"song.alt_titles as song_alt_titles",
	"song.data as song_data",
	"song.game_group as song_game_group",
] as const;

/** Song row fields needed to write PG rows back into `songs-${game}.json`. */
export const SELECT_SONG_DOCUMENT_FOR_SEED_EXPORT = [
	...SELECT_SONG_DOCUMENT,
	"song.legacy_id as song_legacy_id",
] as const;

export type SongSeedExportRow = Selection<
	Database,
	"song",
	(typeof SELECT_SONG_DOCUMENT_FOR_SEED_EXPORT)[number]
>;

/** Full `song` row for single-table queries (e.g. title search). */
export const SELECT_SONG_ROW = [
	"song.id",
	"song.game_group",
	"song.title",
	"song.artist",
	"song.search_terms",
	"song.alt_titles",
	"song.fts_document",
	"song.textsearch",
	"song.data",
] as const;

export type SongRow = Selection<Database, "song", (typeof SELECT_SONG_ROW)[number]>;

export async function GetSongByID(
	game: GameGroup,
	id: string,
): Promise<{ doc: SongDocument; newSongID: string } | undefined> {
	const row = await DB.selectFrom("song")
		.select(SELECT_SONG_DOCUMENT)
		.where("song.id", "=", id)
		.where("game_group", "=", game)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	const doc: SongDocument = {
		id: row.song_id,
		title: row.song_title,
		artist: row.song_artist,
		searchTerms: row.song_search_terms,
		altTitles: row.song_alt_titles,
		data: row.song_data as SongDocumentData[typeof game],
	};

	return { doc, newSongID: row.song_id };
}

export async function GetSongsByIDs(ids: Array<string>): Promise<Array<SongDocument>> {
	if (ids.length === 0) {
		return [];
	}

	const unique = [...new Set(ids)];

	const songRows = await DB.selectFrom("song")
		.select(SELECT_SONG_DOCUMENT)
		.where("song.id", "in", unique)
		.execute();

	if (songRows.length === 0) {
		return [];
	}

	const out = [];

	for (const row of songRows) {
		out.push({
			id: row.song_id,
			title: row.song_title,
			artist: row.song_artist,
			searchTerms: row.song_search_terms,
			altTitles: row.song_alt_titles,
			data: row.song_data as SongDocumentData[GameGroup],
		});
	}

	return out;
}

export function ToSongDocument(
	row: Selection<Database, "song", (typeof SELECT_SONG_DOCUMENT)[number]>,
): SongDocument {
	return {
		id: row.song_id,
		title: row.song_title,
		artist: row.song_artist,
		searchTerms: row.song_search_terms,
		altTitles: row.song_alt_titles,
		data: row.song_data as SongDocumentData[typeof row.song_game_group],
	};
}

/** Shape expected by seed import (`legacySongID` + id fields PG uses elsewhere). */
export function ToSeedSongDocument(row: SongSeedExportRow): SEEDS_SongDocument<GameGroup> {
	const gg = row.song_game_group;
	return {
		id: row.song_id,
		title: row.song_title,
		artist: row.song_artist,
		searchTerms: row.song_search_terms,
		altTitles: row.song_alt_titles,
		data: row.song_data as SongDocumentData[typeof gg],
		legacySongID: Number(row.song_legacy_id),
	} as SEEDS_SongDocument<GameGroup>;
}

export function ToSongDocumentFromRow(row: SongRow): SongDocument {
	return {
		id: row.id,
		title: row.title,
		artist: row.artist,
		searchTerms: row.search_terms,
		altTitles: row.alt_titles,
		data: row.data as SongDocumentData[typeof row.game_group],
	};
}
