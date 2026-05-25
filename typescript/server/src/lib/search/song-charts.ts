import { GetChartsBySongId } from "#lib/db-formats/chart";
import { AllEnabledGames } from "#lib/setup/config";
import DB from "#services/pg/db";
import {
	type ChartDocument,
	GameToGameGroup,
	type integer,
	type SongDocument,
	type V3Game,
} from "tachi-common";

import { MAX_SONG_SEARCH_RESULTS_PER_GAME, searchSpecificGameSongs } from "./songs";

export async function SearchSpecificGameSongsAndCharts(game: V3Game, search: string, limit = 100) {
	const { songs } = await searchSpecificGameSongs(GameToGameGroup(game), search, limit);

	// TODO(zk): this is ridiculously slow. We can do a fucking join.
	const chartLists = await Promise.all(
		songs.map((song) =>
			GetChartsBySongId(game, song.id, {
				omit2dxtraCharts: GameToGameGroup(game) === "iidx",
			}),
		),
	);

	const charts = chartLists.flat();

	return { songs, charts };
}

/**
 * Search this Game/GPTs songs and charts, but globally.
 *
 * Returns at most `limit` **chart** rows per GPT (same cap as song search). Without this,
 * N matched songs × charts per song could return a huge payload from `/api/v1/search`.
 */
export async function SearchGlobalGameSongsAndCharts(
	game: V3Game,
	search: string,
	limit = MAX_SONG_SEARCH_RESULTS_PER_GAME,
): Promise<Array<{ chart: ChartDocument; playcount: integer; song: SongDocument }>> {
	const { songs } = await searchSpecificGameSongs(GameToGameGroup(game), search, limit);

	const output: Array<{
		chart: ChartDocument;
		playcount: integer;
		song: SongDocument;
	}> = [];

	for (const song of songs) {
		if (output.length >= limit) {
			break;
		}

		// eslint-disable-next-line no-await-in-loop -- stop after enough charts; avoids loading every song's charts when the cap is already reached.
		const songCharts = await GetChartsBySongId(game, song.id, {
			omit2dxtraCharts: GameToGameGroup(game) === "iidx",
		});

		for (const chart of songCharts) {
			if (output.length >= limit) {
				break;
			}

			output.push({
				song,
				chart,
				playcount: 0,
			});
		}
	}

	if (output.length === 0) {
		return [];
	}

	const chartIDs = output.map((o) => o.chart.chartID);

	const playcountRows = await DB.selectFrom("chart_playcount")
		.select(["chart_playcount.chart_id as id", "chart_playcount.playcount"])
		.where("chart_playcount.chart_id", "in", chartIDs)
		.execute();

	const playcountLookup = Object.fromEntries(playcountRows.map((r) => [r.id, r.playcount]));

	for (const row of output) {
		row.playcount = playcountLookup[row.chart.chartID] ?? 0;
	}

	return output;
}

export async function SearchGamesSongsCharts(search: string, games: Array<V3Game> | null) {
	games = games ?? AllEnabledGames();

	const promises = [];

	const results: Partial<
		Record<V3Game, Array<{ chart: ChartDocument; playcount: integer; song: SongDocument }>>
	> = {};

	for (const game of games) {
		promises.push(
			SearchGlobalGameSongsAndCharts(game, search).then((res) => {
				results[game] = res;
			}),
		);
	}

	await Promise.all(promises);

	return results;
}
