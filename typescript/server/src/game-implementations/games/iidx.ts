import type {
	GameImplementation,
	GPTProfileCalcs,
	GPTSessionCalcs,
	PBMergeFunction,
} from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { PoyashiBPI } from "rg-stats";

import {
	IIDXLIKE_PB_RANKING_VALUES,
	IIDXLIKE_SCORE_DERIVER,
	IIDXLIKE_SCORE_VALIDATORS,
	IIDXLIKE_VALIDATORS,
} from "./_common";

/** `iidx:SP` / `iidx:DP` as v3 games. */
type IIDXGames = "iidx-dp" | "iidx-sp";

const IIDX_SESSION_CALCS: GPTSessionCalcs<IIDXGames> = (arr) => ({
	BPI: SessionAvgBest10For("BPI")(arr),
	ktLampRating: SessionAvgBest10For("ktLampRating")(arr),
	ktLampRatingHC: SessionAvgBest10For("ktLampRatingHC")(arr),
	ktLampRatingEXHC: SessionAvgBest10For("ktLampRatingEXHC")(arr),
});

const IIDX_PROFILE_CALCS: GPTProfileCalcs<IIDXGames> = async (game, userID) => {
	const [BPI, ktLampRating, ktLampRatingHC, ktLampRatingEXHC] = await Promise.all([
		ProfileAvgBestN("BPI", 20, true)(game, userID),
		ProfileAvgBestN("ktLampRating", 20)(game, userID),
		ProfileAvgBestN("ktLampRatingHC", 20)(game, userID),
		ProfileAvgBestN("ktLampRatingEXHC", 20)(game, userID),
	]);

	return { BPI, ktLampRating, ktLampRatingHC, ktLampRatingEXHC };
};

const IIDX_MERGERS: Array<PBMergeFunction<IIDXGames>> = [
	CreatePBMergeFor("largest", { type: "REGULAR", metric: "lamp" }, "Best Lamp", (base, lamp) => {
		base.scoreData.lamp = lamp.scoreData.lamp;

		// Update lamp related iidx-specific info from the lampPB.
		base.scoreData.optional.gsmEasy = lamp.scoreData.optional.gsmEasy;
		base.scoreData.optional.gsmNormal = lamp.scoreData.optional.gsmNormal;
		base.scoreData.optional.gsmHard = lamp.scoreData.optional.gsmHard;
		base.scoreData.optional.gsmEXHard = lamp.scoreData.optional.gsmEXHard;

		base.scoreData.optional.gauge = lamp.scoreData.optional.gauge;
		base.scoreData.optional.gaugeHistory = lamp.scoreData.optional.gaugeHistory;

		base.scoreData.optional.comboBreak = lamp.scoreData.optional.comboBreak;
	}),
	CreatePBMergeFor("smallest", { type: "REGULAR", metric: "bp" }, "Lowest BP", (base, bp) => {
		base.scoreData.optional.bp = bp.scoreData.optional.bp;
	}),
];

export const IIDX_SP_IMPL: GameImplementation<"iidx-sp"> = {
	scoreDeriver: IIDXLIKE_SCORE_DERIVER,
	chartSpecificValidators: IIDXLIKE_VALIDATORS,
	pbRankingValues: IIDXLIKE_PB_RANKING_VALUES,
	scoreCalcs: (scoreData, _derivedData, chart) => {
		const bpi =
			chart.data.kaidenAverage === null || chart.data.worldRecord === null
				? null
				: PoyashiBPI.calculate(
						scoreData.score,
						chart.data.kaidenAverage,
						chart.data.worldRecord,
						chart.data.notecount * 2,
						chart.data.bpiCoefficient,
					);

		const ncValue = chart.data.ncTier?.value ?? chart.levelNum;
		const hcValue = Math.max(chart.data.hcTier?.value ?? 0, ncValue);
		const exhcValue = Math.max(chart.data.exhcTier?.value ?? 0, hcValue);

		let ktLampRating: number;

		switch (scoreData.lamp) {
			case "FULL COMBO":
			case "EX HARD CLEAR": {
				ktLampRating = exhcValue;
				break;
			}

			case "HARD CLEAR": {
				ktLampRating = hcValue;
				break;
			}

			case "CLEAR": {
				ktLampRating = ncValue;
				break;
			}

			default:
				ktLampRating = 0;
		}

		const atLeastHcClear =
			scoreData.lamp === "HARD CLEAR" ||
			scoreData.lamp === "EX HARD CLEAR" ||
			scoreData.lamp === "FULL COMBO";
		const atLeastExhcClear =
			scoreData.lamp === "EX HARD CLEAR" || scoreData.lamp === "FULL COMBO";

		const ktLampRatingHC = atLeastHcClear ? hcValue : 0;
		const ktLampRatingEXHC = atLeastExhcClear ? exhcValue : 0;

		return {
			BPI: bpi,
			ktLampRating,
			ktLampRatingHC,
			ktLampRatingEXHC,
		};
	},
	sessionCalcs: IIDX_SESSION_CALCS,
	profileCalcs: IIDX_PROFILE_CALCS,
	classDerivers: (_ratings) => ({}),
	pbMergeFunctions: IIDX_MERGERS,
	defaultMergeRefName: "Best Score",
	scoreValidators: IIDXLIKE_SCORE_VALIDATORS,
	chartDataRelevantFields: [
		"levelNum",
		"data.notecount",
		"data.kaidenAverage",
		"data.worldRecord",
		"data.bpiCoefficient",
		"data.ncTier",
		"data.hcTier",
		"data.exhcTier",
	],
};

export const IIDX_DP_IMPL: GameImplementation<"iidx-dp"> = {
	scoreDeriver: IIDXLIKE_SCORE_DERIVER,
	chartSpecificValidators: IIDXLIKE_VALIDATORS,
	pbRankingValues: IIDXLIKE_PB_RANKING_VALUES,
	scoreCalcs: (scoreData, _derivedData, chart) => {
		const bpi =
			chart.data.kaidenAverage === null || chart.data.worldRecord === null
				? null
				: PoyashiBPI.calculate(
						scoreData.score,
						chart.data.kaidenAverage,
						chart.data.worldRecord,
						chart.data.notecount * 2,
						chart.data.bpiCoefficient,
					);

		const ecValue = chart.data.dpTier?.value ?? chart.levelNum;

		let ktLampRating: number;

		switch (scoreData.lamp) {
			case "FULL COMBO":
			case "EX HARD CLEAR":
			case "HARD CLEAR":
			case "CLEAR":
			case "EASY CLEAR": {
				ktLampRating = ecValue;
				break;
			}

			default:
				ktLampRating = 0;
		}

		const atLeastHcClear =
			scoreData.lamp === "HARD CLEAR" ||
			scoreData.lamp === "EX HARD CLEAR" ||
			scoreData.lamp === "FULL COMBO";
		const atLeastExhcClear =
			scoreData.lamp === "EX HARD CLEAR" || scoreData.lamp === "FULL COMBO";

		const ktLampRatingHC = atLeastHcClear ? ecValue : 0;
		const ktLampRatingEXHC = atLeastExhcClear ? ecValue : 0;

		return {
			BPI: bpi,
			ktLampRating,
			ktLampRatingHC,
			ktLampRatingEXHC,
		};
	},
	sessionCalcs: IIDX_SESSION_CALCS,
	profileCalcs: IIDX_PROFILE_CALCS,
	classDerivers: (_ratings) => ({}),
	pbMergeFunctions: IIDX_MERGERS,
	defaultMergeRefName: "Best Score",
	scoreValidators: IIDXLIKE_SCORE_VALIDATORS,
	chartDataRelevantFields: [
		"levelNum",
		"data.notecount",
		"data.kaidenAverage",
		"data.worldRecord",
		"data.bpiCoefficient",
		"data.dpTier",
	],
};
