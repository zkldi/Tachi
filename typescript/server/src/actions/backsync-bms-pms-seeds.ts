/* eslint-disable no-await-in-loop */

import { MakeAction } from "#lib/actions/actions";
import { SELECT_CHART, ToChartDocument } from "#lib/db-formats/chart";
import { SELECT_SONG_DOCUMENT_FOR_SEED_EXPORT, ToSeedSongDocument } from "#lib/db-formats/song";
import { log } from "#lib/log/log";
import { PullDatabaseSeeds, type SeedsCollections } from "#lib/seeds/repo";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import {
	type ChartDocument,
	GAME_GROUP_CONFIGS,
	type GameGroup,
	type SEEDS_ChartDocument,
	type SEEDS_SongDocument,
	type V3Game,
} from "tachi-common";

async function loadAllSongsForSeedExport(
	gameGroup: GameGroup,
): Promise<Array<SEEDS_SongDocument<GameGroup>>> {
	const rows = await DB.selectFrom("song")
		.select(SELECT_SONG_DOCUMENT_FOR_SEED_EXPORT)
		.where("game_group", "=", gameGroup)
		.orderBy("id", "asc")
		.execute();

	return rows.map(ToSeedSongDocument);
}

async function loadAllChartsForGameGroup(gameGroup: GameGroup): Promise<Array<ChartDocument>> {
	const out = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("song.game_group", "=", gameGroup)
		.orderBy("chart.id", "asc")
		.execute()
		.then((r) => r.map(ToChartDocument));

	return out;
}

/** DB/API chart row → seed file row (`charts-*.json` uses id/songID, not chartID/nested song). */
function chartDocumentToSeedRow<G extends V3Game>(chart: ChartDocument<G>): SEEDS_ChartDocument<G> {
	return {
		id: chart.chartID,
		legacyChartID: chart.legacyChartID,
		songID: chart.song.id,
		level: chart.level,
		levelNum: chart.levelNum,
		isPrimary: chart.isPrimary,
		difficulty: chart.difficulty,
		data: chart.data,
		versions: chart.versions,
	} as SEEDS_ChartDocument<G>;
}

/**
 * Writes live BMS/PMS songs and charts from Postgres into the seeds repo and commits.
 */
export async function runBacksyncBmsPmsSeedsCore() {
	const repo = await PullDatabaseSeeds();

	try {
		for (const gameGroup of ["bms", "pms"] as const) {
			log.info(`Fetching ${gameGroup} songs from DB.`);

			{
				const songs = await loadAllSongsForSeedExport(gameGroup);
				log.info(`Found ${songs.length} ${gameGroup} songs.`);
				await repo.WriteCollection(`songs-${gameGroup}`, songs);
			}

			log.info(`Fetching ${gameGroup} charts from DB.`);

			{
				const charts = await loadAllChartsForGameGroup(gameGroup);
				const chartsByGame = new Map<V3Game, Array<ChartDocument>>();
				for (const c of charts) {
					const list = chartsByGame.get(c.game);
					if (list) {
						list.push(c);
					} else {
						chartsByGame.set(c.game, [c]);
					}
				}

				for (const game of GAME_GROUP_CONFIGS[gameGroup].games) {
					const collection = `charts-${game}` as SeedsCollections;
					const rows = (chartsByGame.get(game) ?? []).map((c) =>
						chartDocumentToSeedRow(c as ChartDocument<typeof game>),
					);

					log.info(`Writing ${rows.length} chart(s) to ${collection}.`);
					await repo.WriteCollection(collection, rows);
				}
			}
		}

		await repo.CommitChangesBack(`Backsync BMS+PMS Songs/Charts ${new Date().toISOString()}`);
	} finally {
		await repo.Destroy();
	}
}

export const ACTION_BacksyncBmsPmsSeeds = MakeAction(
	"BACKSYNC_BMS_PMS_SEEDS",
	async (taker, _input) => {
		if (!(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		await runBacksyncBmsPmsSeedsCore();
		return {};
	},
);
