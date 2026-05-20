import type { KtLogger } from "#lib/log/log";
import type { GameGroup, SongDocument } from "tachi-common";

import { SELECT_SONG_ROW, ToSongDocumentFromRow } from "#lib/db-formats/song";
import {
	AmbiguousTitleFailure,
	InternalFailure,
} from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import { sql } from "kysely";

/**
 * Finds a song document for the given game with the given title (or alt-title).
 * This is NOT the preferred way to find a song, as encodings, and typos, make this
 * rather difficult. Prefer other functions!
 * @param game - The game to search upon.
 * @param title - The song title to match.
 * @returns SongDocument
 */
export async function FindSongOnTitle(
	game: GameGroup,
	title: string,
): Promise<SongDocument | null> {
	const res = await DB.selectFrom("song")
		.select(SELECT_SONG_ROW)
		.where("song.game_group", "=", game)
		.where((eb) =>
			eb.or([eb("song.title", "=", title), sql<boolean>`${title} = ANY(song.alt_titles)`]),
		)
		.limit(2)
		.execute();

	if (res.length === 2) {
		throw new AmbiguousTitleFailure(
			title,
			`Multiple songs exist with the title ${title}. We cannot resolve this. Please try and use a different song resolution method.`,
		);
	}

	return res[0] ? ToSongDocumentFromRow(res[0]) : null;
}

/**
 * Finds a song on a song title case-insensitively.
 * This is needed for services that provide horrifically mutated string titles.
 */
export async function FindSongOnTitleInsensitive(
	game: GameGroup,
	title: string,
	artist?: string | null,
): Promise<SongDocument | null> {
	let q = DB.selectFrom("song")
		.select(SELECT_SONG_ROW)
		.where("song.game_group", "=", game)
		.where((eb) =>
			eb.or([
				sql<boolean>`LOWER(song.title) = LOWER(${title})`,
				sql<boolean>`EXISTS (SELECT 1 FROM unnest(song.alt_titles) AS a WHERE LOWER(a) = LOWER(${title}))`,
			]),
		)
		.limit(2);

	if (artist) {
		q = q.where(sql<boolean>`LOWER(song.artist) = LOWER(${artist})`);
	}

	const res = await q.execute();

	if (res.length === 2) {
		throw new AmbiguousTitleFailure(
			title,
			artist
				? `Multiple songs exist with the case-insensitive title ${title} by artist ${artist}. We cannot resolve this. Please try and use a different song resolution method.`
				: `Multiple songs exist with the case-insensitive title ${title}. We cannot resolve this. Please try adding an artist field.`,
		);
	}

	return res[0] ? ToSongDocumentFromRow(res[0]) : null;
}

/**
 * Finds a song document based on the Tachi songID. Depending on the database this might
 * also be the in-game-ID.
 * @param game - The game to search upon.
 * @param songID - The song ID to match.
 * @returns SongDocument
 */
export async function FindSongOnID(game: GameGroup, songID: string) {
	const row = await DB.selectFrom("song")
		.select(SELECT_SONG_ROW)
		.where("song.game_group", "=", game)
		.where("song.id", "=", songID)
		.executeTakeFirst();

	return row ? ToSongDocumentFromRow(row) : null;
}

/**
 * Find a DDR song by `data.ddrSongHash` (batch-manual `ddrSongHash`).
 */
export async function FindDDRSongOnDDRSongHash(hash: string) {
	const row = await DB.selectFrom("song")
		.select(SELECT_SONG_ROW)
		.where("song.game_group", "=", "ddr")
		.where(sql<boolean>`(song.data::jsonb->>'ddrSongHash') = ${hash}`)
		.executeTakeFirst();

	return row ? ToSongDocumentFromRow(row) : null;
}

export async function FindSongOnIDGuaranteed(game: GameGroup, songID: string, log: KtLogger) {
	const song = await FindSongOnID(game, songID);

	if (!song) {
		log.error(`Song-Chart desync for ${songID}. Has charts, but no song.`);
		throw new InternalFailure(`Song-Chart desync for ${songID}. Has charts, but no song.`);
	}

	return song;
}
