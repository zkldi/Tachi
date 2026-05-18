import type { Database, Game } from "tachi-db";

import DB from "#services/pg/db";
import { type Selection, sql, type SqlBool } from "kysely";
import {
	type ChartDocument,
	type ChartDocumentData,
	type Difficulties,
	GameToGameGroup,
	type SongDocument,
	type V3Game,
	type Versions,
} from "tachi-common";

import { SELECT_SONG_DOCUMENT } from "./song";

export const SELECT_CHART = [
	"chart.id as chart_id",
	"chart.legacy_id as chart_legacy_id",
	"chart.game as chart_game",
	"chart.level as chart_level",
	"chart.level_num as chart_level_num",
	"chart.is_primary as chart_is_primary",
	"chart.difficulty as chart_difficulty",
	"chart.versions as chart_versions",
	"chart.data as chart_data",
	"chart.song_id as chart_song_id",
	...SELECT_SONG_DOCUMENT,
] as const;

export type ChartRow = Selection<Database, "chart" | "song", (typeof SELECT_CHART)[number]>;

export function ToChartDocument(row: ChartRow): ChartDocument {
	return {
		game: row.chart_game,
		chartID: row.chart_id,
		legacyChartID: row.chart_legacy_id,
		song: {
			altTitles: row.song_alt_titles,
			artist: row.song_artist,
			data: row.song_data as SongDocument["data"],
			id: row.song_id,
			searchTerms: row.song_search_terms,
			title: row.song_title,
		},
		level: row.chart_level,
		levelNum: row.chart_level_num,
		isPrimary: row.chart_is_primary,
		difficulty: row.chart_difficulty as Difficulties[V3Game],
		data: row.chart_data as ChartDocumentData[V3Game],
		versions: row.chart_versions as Versions[V3Game][],
	};
}

/**
 * Fetches all charts for a given game (e.g. "iidx-sp") and song id,
 * including `chart.versions`. Returns fully-formed ChartDocuments using the provided
 * legacy song ID for the `songID` field.
 */
export async function GetChartsBySongId(
	v3Game: Game,
	songID: string,
	opts?: { omit2dxtraCharts?: boolean },
): Promise<ChartDocument[]> {
	let q = DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song_id", "=", songID)
		.where("game", "=", v3Game);

	const gameGroup = GameToGameGroup(v3Game);

	if (opts?.omit2dxtraCharts && gameGroup === "iidx") {
		q = q.where(sql<SqlBool>`(chart.data->>'2dxtraSet') IS NULL`);
	}

	const rows = await q.execute();

	return rows.map((row) => ToChartDocument(row));
}

/**
 * Loads a single chart by Postgres `chart.id`.
 */
export async function GetChartById(chartID: string): Promise<ChartDocument | undefined> {
	const chartRow = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "=", chartID)
		.executeTakeFirst();

	if (!chartRow) {
		return undefined;
	}

	return ToChartDocument(chartRow);
}

export async function GetChartByIdForGame(
	game: Game,
	chartID: string,
): Promise<ChartDocument | undefined> {
	const chartRow = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "=", chartID)
		.where("chart.game", "=", game)
		.executeTakeFirst();

	if (!chartRow) {
		return undefined;
	}

	return ToChartDocument(chartRow);
}

// Loads charts from a list of IDs.
// This function should rarely be used - it's an antipattern in sql to do queries like this.
export async function GetChartsByIds(chartIDs: Array<string>): Promise<Array<ChartDocument>> {
	if (chartIDs.length === 0) {
		return [];
	}

	const unique = [...new Set(chartIDs)];

	const rows = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "in", unique)
		.execute();

	return rows.map(ToChartDocument);
}
