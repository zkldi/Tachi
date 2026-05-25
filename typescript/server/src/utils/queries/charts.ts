import type { Game } from "tachi-db";

import { SELECT_CHART, ToChartDocument } from "#lib/db-formats/chart";
import { SELECT_SONG_DOCUMENT, ToSongDocument } from "#lib/db-formats/song";
import { InvalidScoreFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import { sql, type SqlBool } from "kysely";
import {
	type ChartDocument,
	type Difficulties,
	type GameGroup,
	type GamesForGroup,
	type integer,
	LEGACY_GameGroupPTToGame,
	type LEGACY_Playtype,
	type SongDocument,
	type V3Game,
	type Versions,
} from "tachi-common";

export async function FindChartWithChartID(chartID: string) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "=", chartID)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Find chart with PlaytypeDifficulty. This only finds charts that have `isPrimary` set to true.
 * If you want to find charts that are not primary, you need to use PTDFVersion.
 * @see FindChartWithSongDifficultyVersion
 */
export async function FindChartWithSongDifficulty<TGame extends V3Game = V3Game>(
	game: TGame,
	songID: string,
	difficulty: Difficulties[TGame],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.id", "=", songID)
		.where("chart.game", "=", game)
		.where("chart.difficulty", "=", difficulty as string)
		.where("chart.is_primary", "=", true)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Like FindchartWithSongDifficulty, but with O.N.G.E.K.I.'s LUNATIC/Re:MASTER merger.
 * @see FindChartWithSongDifficulty
 */
export async function FindOngekiChartWithSongDifficulty<TGame extends V3Game = V3Game>(
	game: "ongeki",
	songID: string,
	difficulty: Difficulties[TGame],
) {
	if (difficulty === "Re:MASTER") {
		// Importers shall not specify the Re:MASTER difficulty directly.
		return null;
	}

	let query = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.id", "=", songID)
		.where("chart.game", "=", game);

	if (difficulty === "LUNATIC") {
		query = query.where("chart.difficulty", "in", ["LUNATIC", "Re:MASTER"]);
	} else {
		query = query.where("chart.difficulty", "=", difficulty as string);
	}
	const row = await query.execute();

	if (row.length === 0) {
		return null;
	}

	if (row.length > 1) {
		throw new InvalidScoreFailure("This chart cannot be matched by songTitle+difficulty.");
	}

	return ToChartDocument(row[0]);
}

/**
 * Find chart with Playtype, Difficulty and a given version. This does not necessarily return a chart that has
 * `isPrimary` set.
 */
export async function FindChartWithSongDifficultyVersion<TGame extends V3Game = V3Game>(
	game: TGame,
	songID: string,
	difficulty: Difficulties[TGame],
	version: Versions[TGame],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.id", "=", songID)
		.where("chart.game", "=", game)
		.where("chart.difficulty", "=", difficulty as string)
		.where(sql<boolean>`${sql.lit(String(version))} = ANY(chart.versions)`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

export async function FindITGChartOnHash(hash: string) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "itg-stamina" as Game)
		.where(sql<boolean>`(chart.data::jsonb->>'hashGSv3') = ${hash}`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Find a BMS chart on either its md5sum or its sha256sum.
 * @param hash The md5 or sha256 hash to look for.
 */
export async function FindBMSChartOnHash(hash: string) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "bms")
		.where((eb) =>
			eb.or([
				sql<boolean>`(chart.data::jsonb->>'hashMD5') = ${hash}`,
				sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`,
			]),
		)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row) as ChartDocument<GamesForGroup["bms"]>;
}

/**
 * BMS charts for a playtype whose chart `data` has sieglinde EC or HC &gt; 0 (GPT sieglinde-charts),
 * with joined song rows (`songs[i]` matches `charts[i]`).
 */
export async function FindBMSSieglindeRatedCharts(game: "bms-7k" | "bms-14k"): Promise<{
	charts: Array<ChartDocument<GamesForGroup["bms"]>>;
	songs: Array<SongDocument<"bms">>;
}> {
	const sglEcPositive = sql<boolean>`(chart.data::jsonb->>'sglEC') IS NOT NULL AND (chart.data::jsonb->>'sglEC') <> '' AND (chart.data::jsonb->>'sglEC')::numeric > 0`;
	const sglHcPositive = sql<boolean>`(chart.data::jsonb->>'sglHC') IS NOT NULL AND (chart.data::jsonb->>'sglHC') <> '' AND (chart.data::jsonb->>'sglHC')::numeric > 0`;

	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.select(SELECT_SONG_DOCUMENT)
		.where("chart.game", "=", game)
		.where((eb) => eb.or([sglEcPositive, sglHcPositive]))
		.orderBy("chart.id")
		.execute();

	const charts: Array<ChartDocument<GamesForGroup["bms"]>> = [];
	const songs: Array<SongDocument<"bms">> = [];

	for (const row of rows) {
		charts.push(ToChartDocument(row) as ChartDocument<GamesForGroup["bms"]>);
		songs.push(ToSongDocument(row) as SongDocument<"bms">);
	}

	return { charts, songs };
}

/** Like {@link FindBMSChartOnHash}, scoped to a single BMS v3 game (`bms-7k` / `bms-14k`). */
export async function FindBMSChartOnHashInGame(hash: string, v3Game: Game) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", v3Game)
		.where((eb) =>
			eb.or([
				sql<boolean>`(chart.data::jsonb->>'hashMD5') = ${hash}`,
				sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`,
			]),
		)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row) as ChartDocument<GamesForGroup["bms"]>;
}

/** All BMS charts matching MD5 or SHA256 in chart data. Used by global chart-hash search. */
export async function FindBMSChartsByHashMd5OrSha256(hash: string): Promise<Array<ChartDocument>> {
	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "bms")
		.where((eb) =>
			eb.or([
				sql<boolean>`(chart.data::jsonb->>'hashMD5') = ${hash}`,
				sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`,
			]),
		)
		.execute();

	return rows.map(ToChartDocument);
}

/** All PMS charts matching MD5 or SHA256 in chart data. Used by global chart-hash search. */
export async function FindPMSChartsByHashMd5OrSha256(hash: string): Promise<Array<ChartDocument>> {
	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "pms")
		.where((eb) =>
			eb.or([
				sql<boolean>`(chart.data::jsonb->>'hashMD5') = ${hash}`,
				sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`,
			]),
		)
		.execute();

	return rows.map(ToChartDocument);
}

/** All ITG Stamina charts matching hashGSv3. Used by global chart-hash search. */
export async function FindITGChartsByHashGSv3(hash: string): Promise<Array<ChartDocument>> {
	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "itg-stamina" as Game)
		.where(sql<boolean>`(chart.data::jsonb->>'hashGSv3') = ${hash}`)
		.execute();

	return rows.map(ToChartDocument);
}

/**
 * Beatoraja IR: chart by `data.hashSHA256` - BMS first, then PMS (SHA256 only; not MD5).
 */
export async function FindBeatorajaChartOnHashSHA256(
	hash: string,
): Promise<ChartDocument<GamesForGroup["bms"] | GamesForGroup["pms"]> | null> {
	const bmsRow = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "bms")
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`)
		.executeTakeFirst();

	if (bmsRow) {
		return ToChartDocument(bmsRow) as ChartDocument<GamesForGroup["bms"]>;
	}

	const pmsRow = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "pms")
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`)
		.executeTakeFirst();

	if (!pmsRow) {
		return null;
	}

	return ToChartDocument(pmsRow) as ChartDocument<GamesForGroup["pms"]>;
}

/**
 * Find a Pop'n chart by SHA256 hash in chart data (batch-manual `popnChartHash`).
 */
export async function FindPopnChartOnHashSHA256(hash: string) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "popn")
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Returns true if at least one chart exists for this song.
 */
export async function SongHasAnyChart(game: GameGroup, songID: string): Promise<boolean> {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select("chart.id")
		.where("song.game_group", "=", game)
		.where("song.id", "=", songID)
		.executeTakeFirst();

	return row !== undefined;
}

/**
 * In Game IDs are sometimes arrays of inGameIDs. I don't personally like this - makes the sql very
 * complex, but whatever.
 */
function sqlChartDataInGameIDEquals(inGameID: number) {
	return sql<boolean>`(
		(jsonb_typeof(chart.data::jsonb->'inGameID') = 'number' AND (chart.data::jsonb->>'inGameID')::int = ${inGameID})
		OR
		(jsonb_typeof(chart.data::jsonb->'inGameID') = 'array' AND (chart.data::jsonb->'inGameID') @> to_jsonb(${inGameID}::int))
	)`;
}

/**
 * Find a chart on its in-game-ID, playtype and difficulty.
 */
export async function FindChartOnInGameID(
	game: V3Game,
	inGameID: number,
	difficulty: Difficulties[V3Game],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where("chart.difficulty", "=", difficulty as string)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Like {@link FindChartOnInGameID}, but only matches charts with `isPrimary` set (batch-manual / legacy Mongo parity).
 */
export async function FindChartOnInGameIDPrimary(
	game: V3Game,
	inGameID: number,
	difficulty: Difficulties[V3Game],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where("chart.difficulty", "=", difficulty as string)
		.where("chart.is_primary", "=", true)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * If exactly one chart for {@link game} has this in-game ID (same matching rules as {@link FindChartOnInGameID}),
 * return it; otherwise return null (including when there are no matches).
 */
export async function FindChartOnInGameIDIfUnique(
	game: V3Game,
	inGameID: number,
): Promise<ChartDocument | null> {
	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sqlChartDataInGameIDEquals(inGameID))
		.limit(2)
		.execute();

	if (rows.length !== 1) {
		return null;
	}

	return ToChartDocument(rows[0]!);
}

/**
 * Finds a non-custom chart on its in-game-ID, playtype and difficulty.
 * This explicitly ignores 2dxtra charts, and is necessary to use for iidx to disambiguate.
 */
export async function FindIIDXChartOnInGameID(
	inGameID: number,
	difficulty: Difficulties[GamesForGroup["iidx"]],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "iidx-sp")
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where(sql<SqlBool>`(chart.data->>'2dxtraSet') IS NULL`)
		.where("chart.is_primary", "=", true)
		.where("chart.difficulty", "=", difficulty as string)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Finds a non-custom chart on its in-game-ID, playtype and difficulty.
 * This explicitly ignores 2dxtra charts, and is necessary to use for iidx to disambiguate.
 */
export async function FindIIDXChartOnInGameIDVersion(
	game: "iidx-dp" | "iidx-sp",
	inGameID: number,
	difficulty: Difficulties[GamesForGroup["iidx"]],
	version: Versions[GamesForGroup["iidx"]],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where(sql<SqlBool>`(chart.data->>'2dxtraSet') IS NULL`)
		.where("chart.difficulty", "=", difficulty as string)
		.where(sql<boolean>`${sql.lit(String(version))} = ANY(chart.versions)`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 *  Like {@link FindChartOnInGameID} with an exception for O.N.G.E.K.I.'s LUNATIC/Re:MASTER difficulty.
 */
export async function FindOngekiChartOnInGameID(
	game: "ongeki",
	inGameID: number,
	difficulty: Difficulties[V3Game],
) {
	if (difficulty === "Re:MASTER") {
		// Importers shall not specify the Re:MASTER difficulty directly.
		return null;
	}

	let query = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sqlChartDataInGameIDEquals(inGameID));

	if (difficulty === "LUNATIC") {
		query = query.where("chart.difficulty", "in", ["LUNATIC", "Re:MASTER"]);
	} else {
		query = query.where("chart.difficulty", "=", difficulty as string);
	}

	const row = await query.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Find a chart on its in-game-ID, playtype, difficulty and version.
 */
export async function FindChartOnInGameIDVersion<TGame extends V3Game = V3Game>(
	game: V3Game,
	inGameID: number,
	difficulty: Difficulties[TGame],
	version: Versions[TGame],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where("chart.difficulty", "=", difficulty as string)
		.where(sql<boolean>`${sql.lit(String(version))} = ANY(chart.versions)`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Find a chart on its in-game string ID, playtype and difficulty (primary chart only).
 */
export async function FindChartOnInGameStrIDPrimary(
	game: V3Game,
	inGameStrID: string,
	difficulty: Difficulties[V3Game],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sql<boolean>`(chart.data::jsonb->>'inGameStrID') = ${inGameStrID}`)
		.where("chart.difficulty", "=", difficulty as string)
		.where("chart.is_primary", "=", true)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Find a chart on its in-game string ID, playtype, difficulty and version.
 */
export async function FindChartOnInGameStrIDVersion<TGame extends V3Game = V3Game>(
	game: V3Game,
	inGameStrID: string,
	difficulty: Difficulties[TGame],
	version: Versions[TGame],
) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sql<boolean>`(chart.data::jsonb->>'inGameStrID') = ${inGameStrID}`)
		.where("chart.difficulty", "=", difficulty as string)
		.where(sql<boolean>`${sql.lit(String(version))} = ANY(chart.versions)`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Finds an IIDX chart on its 2dxtra hash, which is the sha256 of the .1 buffer.
 */
export async function FindIIDXChartWith2DXtraHash(hash: string) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "iidx-sp" as Game)
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

const SDVX_INF_DIFFS = ["INF", "GRV", "HVN", "VVD", "XCD"] as const;

/**
 * Find an SDVX Chart on its in game ID. This exists to handle
 * oddities with SDVX difficulties - If "ANY_INF" is sent, it actually
 * refers to any of INF, GRV, HVN or VVD. This is because some services treat
 * all of those as the same difficulty, but we do not.
 */
export async function FindSDVXChartOnInGameID(
	inGameID: number,
	difficulty: "ANY_INF" | Difficulties[GamesForGroup["sdvx"]],
) {
	let q = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "sdvx")
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where("chart.is_primary", "=", true);

	q =
		difficulty === "ANY_INF"
			? q.where("chart.difficulty", "in", [...SDVX_INF_DIFFS])
			: q.where("chart.difficulty", "=", difficulty);

	const row = await q.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

export async function FindSDVXChartOnInGameIDVersion(
	inGameID: number,
	difficulty: "ANY_INF" | Difficulties[GamesForGroup["sdvx"]],
	version: Versions[GamesForGroup["sdvx"]],
) {
	let q = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", "sdvx")
		.where(sqlChartDataInGameIDEquals(inGameID))
		.where(sql<boolean>`${sql.lit(String(version))} = ANY(chart.versions)`);

	q =
		difficulty === "ANY_INF"
			? q.where("chart.difficulty", "in", [...SDVX_INF_DIFFS])
			: q.where("chart.difficulty", "=", difficulty);

	const row = await q.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

export async function FindSDVXChartOnDFVersion(
	songID: string,
	difficulty: "ANY_INF" | Difficulties[GamesForGroup["sdvx"]],
	version: Versions[GamesForGroup["sdvx"]],
) {
	let q = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "sdvx")
		.where("song.id", "=", songID)
		.where("chart.game", "=", "sdvx")
		.where(sql<boolean>`${sql.lit(String(version))} = ANY(chart.versions)`);

	q =
		difficulty === "ANY_INF"
			? q.where("chart.difficulty", "in", [...SDVX_INF_DIFFS])
			: q.where("chart.difficulty", "=", difficulty);

	const row = await q.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

export async function FindChartOnSHA256(game: GameGroup, hash: string) {
	if (game !== "bms" && game !== "usc" && game !== "iidx" && game !== "pms") {
		throw new Error(`Cannot call FindChartOnSHA256 for game ${game}.`);
	}

	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", game)
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

export async function FindChartOnSHA256Playtype(
	game: GameGroup,
	hash: string,
	playtype: LEGACY_Playtype,
) {
	if (game !== "bms" && game !== "usc" && game !== "iidx" && game !== "pms") {
		throw new Error(`Cannot call FindChartOnSHA256 for game ${game}.`);
	}

	const v3Game = LEGACY_GameGroupPTToGame(game, playtype) as Game;

	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", game)
		.where("chart.game", "=", v3Game)
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA256') = ${hash}`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/**
 * Find a USC chart on its SHA1 hash (from chart data) and playtype.
 * Used by the USC IR and batch-manual uscChartHash matching.
 */
export async function FindUSCChartOnSHA1(hash: string, game: "usc-controller" | "usc-keyboard") {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.game", "=", game)
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA1') = ${hash}`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToChartDocument(row);
}

/** All USC charts matching a SHA1 hash (any playtype). Used by global chart-hash search. */
export async function FindUSCChartsByHashSHA1(hash: string): Promise<Array<ChartDocument>> {
	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", "usc") // OPTIMISATION
		.where(sql<boolean>`(chart.data::jsonb->>'hashSHA1') = ${hash}`)
		.execute();

	return rows.map((row) => ToChartDocument(row));
}

/**
 * Returns the N most popular charts for this game + playtype.
 * Popularity is determined by cached total score rows per chart (`chart_playcount`).
 */
export async function FindChartsOnPopularity(
	game: V3Game,
	filters?: { chartIDs: Array<string> | undefined; songIDs: Array<string> | undefined },
	skip = 0,
	limit = 100,
): Promise<Array<{ __playcount: integer } & ChartDocument>> {
	if (filters?.chartIDs?.length === 0) {
		return [];
	}

	if (filters?.songIDs?.length === 0) {
		return [];
	}

	const chartIdFilter = filters?.chartIDs;

	let q = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("chart_playcount", "chart_playcount.chart_id", "chart.id")
		.where("chart.game", "=", game)
		.where(sql<SqlBool>`(chart.data->>'2dxtraSet') IS NULL`);

	if (chartIdFilter !== undefined) {
		q = q.where("chart.id", "in", chartIdFilter);
	}

	if (filters?.songIDs) {
		q = q.where("song.id", "in", filters.songIDs);
	}

	const rows = await q
		.select([
			...SELECT_CHART, // format-bearing comment
			sql<number>`coalesce(chart_playcount.playcount, 0)::int`.as("playcount"),
		])
		.orderBy(sql`coalesce(chart_playcount.playcount, 0)`, "desc")
		.offset(skip)
		.limit(limit)
		.execute();

	if (rows.length === 0) {
		return [];
	}

	return rows.map((row) => {
		const r = ToChartDocument(row) as { __playcount: integer } & ChartDocument;

		r.__playcount = row.playcount;

		return r;
	});
}
