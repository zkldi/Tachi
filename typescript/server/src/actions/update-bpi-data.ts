/* eslint-disable no-await-in-loop */
import type { ChartDocument, Difficulties, GamesForGroup, integer } from "tachi-common";

import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import { MakeAction } from "#lib/actions/actions";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import fetch from "#utils/fetch";
import {
	FindChartWithSongDifficulty,
	FindChartWithSongDifficultyVersion,
} from "#utils/queries/charts";
import { FindSongOnTitle } from "#utils/queries/songs";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { z } from "zod";

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

const BPIM2_TITLE_TRANSLATIONS: Record<string, string> = {
	Flamingo: "Flämingo",
	"SμG@R RU$#": "SµG@R RU$#",
	uen: "uən",
	VOID: "VØID",
};

const BPIM2SongsResponseSchema = z.object({
	error: z.boolean(),
	errorMessage: z.string().nullable(),
	body: z.array(
		z.object({
			title: z.string(),
			difficulty: z.enum(["ANOTHER", "HYPER", "LEGGENDARIA"]),
			difficultyLevel: z.number().int(),
			notes: z.number().int().positive(),
			wrScore: z.number().int().positive().nullable(),
			kaidenAvg: z.number().int().positive().nullable(),
			coef: z.union([z.number().positive(), z.literal(-1)]).nullable(),
			mu: z.number().nullable(),
			sigma: z.number().positive().nullable(),
		}),
	),
});

/**
 * Fetch BPI constants from Poyashi
 */
export async function updateBpiDataCore() {
	log.info("Fetching BPI definitions...");
	const [data, bpi2Data] = await Promise.all([
		fetch("https://proxy.poyashi.me/?type=bpi").then((r) =>
			r.json(),
		) as Promise<PoyashiProxyData>,
		fetch("https://bpi2.poyashi.me/api/v2/songs", {
			headers: { "User-Agent": "Tachi/3.0 (+https://github.com/zkldi/Tachi)" },
		}).then(async (r) => {
			if (!r.ok) {
				throw new Error(`BPIM2 returned HTTP ${r.status}.`);
			}

			return BPIM2SongsResponseSchema.parse(await r.json());
		}),
	]);

	if (bpi2Data.error || !Array.isArray(bpi2Data.body)) {
		throw new Error(
			`Failed to fetch BPIM2 definitions: ${bpi2Data.errorMessage ?? "unknown error"}`,
		);
	}

	log.info("Fetched BPI definitions.");
	const updatedChartIDs = new Set<string>();

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
			updatedChartIDs.add(tachiChart.chartID);

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

	const sortedBpi2Data = [...bpi2Data.body].sort(
		(a, b) =>
			Number(a.mu !== null && a.sigma !== null) - Number(b.mu !== null && b.sigma !== null),
	);

	for (const d of sortedBpi2Data) {
		if (d.difficultyLevel !== 11 && d.difficultyLevel !== 12) {
			continue;
		}

		const translatedTitle = BPIM2_TITLE_TRANSLATIONS[d.title] ?? d.title;
		const normalizedTitle = translatedTitle.normalize("NFKC");
		const tachiSong =
			(await FindSongOnTitle("iidx", translatedTitle)) ??
			(normalizedTitle === translatedTitle
				? null
				: await FindSongOnTitle("iidx", normalizedTitle));

		if (!tachiSong) {
			log.warn(`Cannot find BPIM2 song ${d.title}?`);
			continue;
		}

		const tachiChart = await FindChartWithSongDifficulty<"iidx-sp">(
			"iidx-sp",
			tachiSong.id,
			d.difficulty,
		);

		if (!tachiChart) {
			log.warn(`Cannot find BPIM2 chart ${tachiSong.title} iidx-sp, ${d.difficulty}?`);
			continue;
		}

		const iidxChart = tachiChart as ChartDocument<"iidx-sp">;
		const coefficient = d.coef === -1 ? null : d.coef;

		if (iidxChart.data.notecount !== d.notes) {
			log.warn(
				`BPIM2 note count mismatch for ${tachiSong.title} ${d.difficulty}: ` +
					`${d.notes} upstream, ${iidxChart.data.notecount} in Tachi.`,
			);
			continue;
		}

		if (
			iidxChart.data.bpiCoefficient !== coefficient ||
			iidxChart.data.kaidenAverage !== d.kaidenAvg ||
			iidxChart.data.worldRecord !== d.wrScore ||
			iidxChart.data.bpi2Mu !== d.mu ||
			iidxChart.data.bpi2Sigma !== d.sigma
		) {
			updatedChartIDs.add(tachiChart.chartID);

			const mergedData = {
				...iidxChart.data,
				bpiCoefficient: coefficient,
				kaidenAverage: d.kaidenAvg,
				worldRecord: d.wrScore,
				bpi2Mu: d.mu,
				bpi2Sigma: d.sigma,
			};

			const updatedChart = { ...tachiChart, data: mergedData } as ChartDocument;
			const checksum = ComputeChartStabilityChecksum("iidx-sp", updatedChart);

			await DB.updateTable("chart")
				.set({
					data: mergedData as object,
					derivation_checksum: checksum,
				})
				.where("id", "=", tachiChart.chartID)
				.execute();
		}
	}

	if (updatedChartIDs.size !== 0) {
		log.info(
			`Finished applying BPI changes in Postgres (${updatedChartIDs.size} charts). ` +
				`Score re-derivation will be handled by the score_rederive queue.`,
		);
	}

	return { chartsUpdated: updatedChartIDs.size };
}

export const ACTION_UpdateBpiData = MakeAction("UPDATE_BPI_DATA", async (taker, _input) => {
	if (!(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorized to perform this action.");
	}

	return updateBpiDataCore();
});
