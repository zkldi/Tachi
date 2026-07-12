import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBestNFor } from "#game-implementations/utils/session-calc";
import { ITGHighestUnbroken } from "rg-stats";
import { GetGrade, ITG_GBOUNDARIES } from "tachi-common";

export const ITG_STAMINA_IMPL: GameImplementation<"itg-stamina"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		// *important*: don't check survivedPercent === 100 - floating point can
		// produce a 100% survived-percent on a fail for very long charts.
		finalPercent:
			scoreData.lamp === "FAILED" ? scoreData.survivedPercent : 100 + scoreData.scorePercent,
		grade:
			scoreData.lamp === "FAILED" ? "F" : GetGrade(ITG_GBOUNDARIES, scoreData.scorePercent),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => {
		const blockRating = scoreData.lamp === "FAILED" ? null : chart.data.rankedLevel;

		const diedAtMeasure =
			scoreData.lamp === "FAILED"
				? (scoreData.survivedPercent / 100) * chart.data.notesPerMeasure.length
				: null;

		const fastest32Raw = ITGHighestUnbroken.calculateFromNPSPerMeasure(
			chart.data.npsPerMeasure,
			chart.data.notesPerMeasure,
			diedAtMeasure,
			32,
		);

		const fastest32 = fastest32Raw !== null && fastest32Raw >= 100 ? fastest32Raw : null;

		return { blockRating, fastest32 };
	},
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.finalPercent,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => ({
		blockRating: SessionAvgBestNFor("blockRating", 5)(arr),
	}),
	profileCalcs: async (game, userID) => {
		const [highestBlock, fastest32] = await Promise.all([
			ProfileSumBestN("blockRating", 1, true)(game, userID),
			ProfileSumBestN("fastest32", 1, true)(game, userID),
		]);

		return { highestBlock, fastest32 };
	},
	classDerivers: (_ratings) => ({}),
	pbMergeFunctions: [
		// we'll pluck the best lamp, but this game has a pretty interesting concept
		// for merging PBs. This is probably fine.
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "lamp" },
			"Best Lamp",
			(base, score) => {
				base.scoreData.lamp = score.scoreData.lamp;
			},
		),
	],

	// this name sucks, what should we do instead? TODO.
	defaultMergeRefName: "Best Result",
	chartDataRelevantFields: ["data.rankedLevel", "data.notesPerMeasure", "data.npsPerMeasure"],

	scoreValidators: [
		(s) => {
			if (s.scoreData.lamp !== "FAILED" && s.scoreData.survivedPercent < 100) {
				return "Cannot clear a chart that you didn't survive 100% of.";
			}
		},
		(s) => {
			let { fantastic, excellent, great, decent, wayoff, miss } = s.scoreData.judgements;

			fantastic ??= 0;
			excellent ??= 0;
			great ??= 0;
			decent ??= 0;
			wayoff ??= 0;
			miss ??= 0;

			if (s.scoreData.lamp === "QUINT") {
				if (fantastic + excellent + great + decent + wayoff + miss > 0) {
					return "Cannot have a QUINT with any fantastic (or worse) judgements.";
				}
			}

			if (s.scoreData.lamp === "QUAD") {
				if (excellent + great + decent + wayoff + miss > 0) {
					return "Cannot have a QUAD with any excellent (or worse) judgements.";
				}
			}

			if (s.scoreData.lamp === "FULL EXCELLENT COMBO") {
				if (great + decent + wayoff + miss > 0) {
					return "Cannot have a FULL EXCELLENT COMBO with any great (or worse) judgements.";
				}
			}

			if (s.scoreData.lamp === "FULL COMBO") {
				if (decent + wayoff + miss > 0) {
					return "Cannot have a FULL COMBO with any combo breaks.";
				}
			}
		},
	],
};
