import fs from "fs";
import path from "path";

import type { TableRes } from "../fetch-tables";
import type { CalcReturns } from "../types";

import logger from "../logger";
import {
	ChunkifyPromiseAll,
	GetBaseline,
	GetFString,
	GetScoresForMD5,
	GetSigmoidalValue,
} from "../util";
import { type Computations, DifficultyComputer } from "./util/calc";
import { fmtSgl } from "./util/format-sgl";
import { type EcConstants, lerpBetwixt } from "./util/lerp";

/**
 * Sieglinde V1 calc. This was wrote by JiminP, and determines "player skill" and
 * compares it against clear rates on each songs. This is circular, so it runs for
 * a while until the alpha converges.
 */
export default async function SieglindeV1Calc(tableInfo: TableRes): Promise<Array<CalcReturns>> {
	// We can't do this in full-parallel. The LR2IR hyper-aggressively rate limits this stuff.
	const promises = tableInfo.charts.map((chart) => async () => {
		const baseLine = GetBaseline(tableInfo.table, chart.level);

		if (baseLine === null) {
			logger.info(`Skipped level ${tableInfo.table.name} ${chart.level}`);
			return [];
		}

		const scores = (await GetScoresForMD5(chart.md5)).filter(
			(d: { clear: number; minbp: number; notes: number }) =>
				d.clear > 0 && d.minbp < d.notes * 0.2,
		);

		// 0 -> noplay, 1 -> failed.. etc.
		return scores.map((score: { clear: number; id: number }) => ({
			md5: chart.md5,
			userID: score.id,
			clear: score.clear,
		}));
	});

	const dataArr = await ChunkifyPromiseAll(promises, 100);

	const data = dataArr.flat();

	const ecComputer = new DifficultyComputer(
		data.map((d) => ({
			...d,

			// better than or equal to ec
			clear: d.clear >= 2,
		})),
	);

	const hcComputer = new DifficultyComputer(
		data.map((d) => ({
			...d,

			// better than or equal to hc
			clear: d.clear >= 4,
		})),
	);

	calcRegressionsOrCache(ecComputer, `${tableInfo.table.name}-ec`);
	calcRegressionsOrCache(hcComputer, `${tableInfo.table.name}-hc`);

	const chartsWithLevels = tableInfo.charts.filter((chart) =>
		ecComputer.songDifficulty.has(chart.md5),
	);

	const cutoffs: Record<string, { count: number; sum: number }> = {};

	// create a record of { insane1: count, sum }
	for (const chart of chartsWithLevels) {
		const existingCutoff = cutoffs[chart.level];

		if (!existingCutoff) {
			cutoffs[chart.level] = {
				count: 1,
				sum: ecComputer.songDifficulty.get(chart.md5)!,
			};
		} else {
			cutoffs[chart.level] = {
				count: existingCutoff.count + 1,
				sum: existingCutoff.sum + ecComputer.songDifficulty.get(chart.md5)!,
			};
		}
	}

	// warning: stupid
	const avgCutoffs: EcConstants = Object.entries(cutoffs)
		.map(([key, data]) => ({
			levelName: key,
			averageSigma: data.sum / data.count,
		}))

		// @warning
		// This is **completely broken** if a harder tier in the table
		// has a worse average sigma. This will catastrophically break lerpwise.
		.sort((a, b) => a.averageSigma - b.averageSigma);

	return chartsWithLevels.map((chart) => {
		const ecSigma = ecComputer.songDifficulty.get(chart.md5)!;
		const hcSigma = hcComputer.songDifficulty.get(chart.md5)!;

		const playcount = ecComputer.songPlaycountMap.get(chart.md5)!;
		const confidence = GetSigmoidalValue(playcount / 1000);

		let ecVal = lerpBetwixt(ecSigma, avgCutoffs, tableInfo.table);
		let hcVal = lerpBetwixt(hcSigma, avgCutoffs, tableInfo.table);

		// at around 1000 scores, we're pretty confident. Between that, apply the delta
		// less, upon a sigmoidal curve.
		if (playcount < 1000) {
			const baseline = GetBaseline(tableInfo.table, chart.level);

			if (baseline === null) {
				throw new Error(
					`Couldn't resolve a baseline for ${tableInfo.table.name} ${chart.level}. Why? Didn't we just do this in lerpBetwixt?`,
				);
			}

			ecVal = baseline + (ecVal - baseline) * confidence;
			hcVal = baseline + (hcVal - baseline) * confidence;
		}

		return {
			md5: chart.md5,
			title: "title" in chart ? String(chart.title) : "",
			baseLevel: GetFString(tableInfo.table, chart),

			ec: ecVal,
			ecStr: fmtSgl(ecVal),

			hc: hcVal,
			hcStr: fmtSgl(hcVal),

			ecMetric: ecSigma,
			hcMetric: hcSigma,

			playcount,
			confidence,
		};
	});
}

/**
 * If regression data exists in the cache, use that instead to avoid recalcing
 * regressions.
 */
function calcRegressionsOrCache(computer: DifficultyComputer, tag: string) {
	try {
		const data = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, `../cache/v1-calc-regressions/${tag}.json`),
				"utf-8",
			),
		) as Computations;

		computer.loadExistingComputations(data);
	} catch (_err) {
		computer.computeDifficulty(tag);
	}
}
