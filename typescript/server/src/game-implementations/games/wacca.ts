import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { WACCARate } from "rg-stats";
import { GetGrade, WACCA_GBOUNDARIES } from "tachi-common";

export const WACCA_IMPL: GameImplementation<"wacca"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(WACCA_GBOUNDARIES, scoreData.score),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		rate: WACCARate.calculate(scoreData.score, chart.levelNum),
	}),
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => ({
		rate: SessionAvgBest10For("rate")(arr),
	}),
	profileCalcs: async (game, userID) => ({
		naiveRate: await ProfileSumBestN("rate", 50)(game, userID),
	}),
	classDerivers: (ratings) => {
		const rate = ratings.naiveRate;

		if (IsNullish(rate)) {
			return { colour: null };
		}

		if (rate >= 2500) {
			return { colour: "RAINBOW" };
		} else if (rate >= 2200) {
			return { colour: "GOLD" };
		} else if (rate >= 1900) {
			return { colour: "SILVER" };
		} else if (rate >= 1600) {
			return { colour: "BLUE" };
		} else if (rate >= 1300) {
			return { colour: "PURPLE" };
		} else if (rate >= 1000) {
			return { colour: "RED" };
		} else if (rate >= 600) {
			return { colour: "YELLOW" };
		} else if (rate >= 300) {
			return { colour: "NAVY" };
		}

		return { colour: "ASH" };
	},
	pbMergeFunctions: [
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "lamp" },
			"Best Lamp",
			(base, score) => {
				base.scoreData.lamp = score.scoreData.lamp;
			},
		),
	],
	defaultMergeRefName: "Best Score",
	chartDataRelevantFields: ["levelNum"],

	scoreValidators: [
		(s) => {
			if (s.scoreData.lamp === "ALL MARVELOUS" && s.scoreData.score !== 1_000_000) {
				return `ALL MARVELOUS scores must have a perfect score. Got ${s.scoreData.score} instead.`;
			}

			// goes both ways
			if (s.scoreData.score === 1_000_000 && s.scoreData.lamp !== "ALL MARVELOUS") {
				return `Perfect scores of 1 million must have ALL MARVELOUS as their lamp. Got ${s.scoreData.lamp} instead.`;
			}
		},
		(s) => {
			const { miss } = s.scoreData.judgements;

			if (miss === null || miss === undefined || miss === 0) {
				return;
			}

			if (s.scoreData.lamp === "FULL COMBO") {
				return "Cannot have a FULL COMBO with misses.";
			}

			if (miss > 5 && s.scoreData.lamp === "MISSLESS") {
				return "Cannot have a MISSLESS lamp with >5 misses.";
			}
		},
		(s) => {
			const { miss, good, great } = s.scoreData.judgements;

			if (s.scoreData.lamp === "ALL MARVELOUS") {
				const mistakes = (miss ?? 0) + (good ?? 0) + (great ?? 0);

				if (mistakes > 0) {
					return "Cannot have an ALL MARVELOUS if all judgements were not marvelous.";
				}
			}
		},
	],
};
