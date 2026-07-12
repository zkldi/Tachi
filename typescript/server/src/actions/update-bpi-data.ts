/* eslint-disable no-await-in-loop */
import type { ChartDocument, Difficulties, GamesForGroup, integer } from "tachi-common";

import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import { MakeAction } from "#lib/actions/actions";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import fetch from "#utils/fetch";
import { FindChartWithSongDifficultyVersion } from "#utils/queries/charts";
import { FindSongOnTitle } from "#utils/queries/songs";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

const difficultyResolve: Record<
	string,
	[GamesForGroup["iidx"], Difficulties[GamesForGroup["iidx"]]]
> = {
	3: ["iidx-sp", "HYPER"],
	4: ["iidx-sp", "ANOTHER"],
	8: ["iidx-dp", "HYPER"],
	9: ["iidx-dp", "ANOTHER"],
	10: ["iidx-sp", "LEGGENDARIA"],
	11: ["iidx-dp", "LEGGENDARIA"],
};

interface PoyashiProxyBPIInfo {
	title: string;
	difficulty: string;
	wr: integer;
	avg: integer;
	notes: string;
	bpm: string;
	textage: string;
	difficultyLevel: string;
	dpLevel: string;
	coef?: number | string | null;
	removed?: boolean;
}

interface PoyashiProxyData {
	version: integer;
	requireVersion: string;
	body: Array<PoyashiProxyBPIInfo>;
}

/**
 * Fetches Poyashi BPI's latest information and writes BPI coefficients / WR / kaiden avg
 * to Postgres `chart.data` for IIDX charts (version 29).
 */
export async function updateBpiDataCore() {
	log.info("Fetching data from proxy...");
	const data = (await fetch("https://proxy.poyashi.me/?type=bpi").then((r) =>
		r.json(),
	)) as PoyashiProxyData;

	log.info("Fetched data.");
	const updatedChartIDs: Array<string> = [];

	for (const d of data.body) {
		const res: [GamesForGroup["iidx"], Difficulties[GamesForGroup["iidx"]]] | undefined =
			difficultyResolve[d.difficulty];

		if (!res) {
			throw new Error(`Unknown difficulty ${d.difficulty}`);
		}

		const [game, diff] = res;

		const tachiSong = await FindSongOnTitle("iidx", d.title);

		if (!tachiSong) {
			log.warn(`Cannot find song ${d.title}?`);
			continue;
		}

		// TODO(zk): why 29? shouldn't this be updated by now?
		const tachiChart = await FindChartWithSongDifficultyVersion(game, tachiSong.id, diff, "29");

		if (!tachiChart) {
			log.warn(`Cannot find chart ${tachiSong.title} (${tachiSong.id}) ${game}, ${diff}?`);
			continue;
		}

		const kavg = Number(d.avg);

		if (kavg < 0) {
			log.warn(`${tachiSong.title} (${game} ${diff}). Invalid kavg ${d.avg}, Skipping.`);
			continue;
		}

		if (d.removed === true) {
			log.info(`Skipping removed chart ${tachiSong.title}.`);
			continue;
		}

		const newCoef = Number(d.coef) === -1 || d.coef === undefined ? null : Number(d.coef);
		const newKavg = Number(d.avg);
		const newWR = Number(d.wr);

		const iidxChart = tachiChart as ChartDocument<GamesForGroup["iidx"]>;

		if (
			iidxChart.data.bpiCoefficient !== newCoef ||
			iidxChart.data.kaidenAverage !== newKavg ||
			iidxChart.data.worldRecord !== newWR
		) {
			updatedChartIDs.push(tachiChart.chartID);

			const mergedData = {
				...iidxChart.data,
				bpiCoefficient: newCoef,
				kaidenAverage: newKavg,
				worldRecord: newWR,
			};

			const updatedChart = { ...tachiChart, data: mergedData } as ChartDocument;
			const checksum = ComputeChartStabilityChecksum(game, updatedChart);

			await DB.updateTable("chart")
				.set({
					data: mergedData as object,
					derivation_checksum: checksum,
				})
				.where("id", "=", tachiChart.chartID)
				.execute();
		}
	}

	if (updatedChartIDs.length !== 0) {
		log.info(
			`Finished applying BPI changes in Postgres (${updatedChartIDs.length} charts). ` +
				`Score re-derivation will be handled by the score_rederive queue.`,
		);
	}

	return { chartsUpdated: updatedChartIDs.length };
}

export const ACTION_UpdateBpiData = MakeAction("UPDATE_BPI_DATA", async (taker, _input) => {
	if (!(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorized to perform this action.");
	}

	return updateBpiDataCore();
});
