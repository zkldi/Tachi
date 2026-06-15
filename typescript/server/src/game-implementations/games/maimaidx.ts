import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { MaimaiDXRate } from "rg-stats";
import { GetGrade, MAIMAIDX_GBOUNDARIES } from "tachi-common";

export const MAIMAIDX_IMPL: GameImplementation<"maimaidx"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(MAIMAIDX_GBOUNDARIES, scoreData.percent),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		rate: MaimaiDXRate.calculate(scoreData.percent, chart.levelNum, scoreData.lamp),
	}),
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.percent,
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

		if (rate >= 16750) {
			return { colour: "RAINBOW_EX_IV" };
		} else if (rate >= 16500) {
			return { colour: "RAINBOW_EX_III" };
		} else if (rate >= 16250) {
			return { colour: "RAINBOW_EX_II" };
		} else if (rate >= 16000) {
			return { colour: "RAINBOW_EX_I" };
		} else if (rate >= 15750) {
			return { colour: "RAINBOW_IV" };
		} else if (rate >= 15500) {
			return { colour: "RAINBOW_III" };
		} else if (rate >= 15250) {
			return { colour: "RAINBOW_II" };
		} else if (rate >= 15000) {
			return { colour: "RAINBOW" };
		} else if (rate >= 14750) {
			return { colour: "PLATINUM_II" };
		} else if (rate >= 14500) {
			return { colour: "PLATINUM" };
		} else if (rate >= 14250) {
			return { colour: "GOLD_II" };
		} else if (rate >= 14000) {
			return { colour: "GOLD" };
		} else if (rate >= 13000) {
			return { colour: "SILVER" };
		} else if (rate >= 12000) {
			return { colour: "BRONZE" };
		} else if (rate >= 10000) {
			return { colour: "PURPLE" };
		} else if (rate >= 7000) {
			return { colour: "RED" };
		} else if (rate >= 4000) {
			return { colour: "YELLOW" };
		} else if (rate >= 2000) {
			return { colour: "GREEN" };
		} else if (rate >= 1000) {
			return { colour: "BLUE" };
		}

		return { colour: "WHITE" };
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
	defaultMergeRefName: "Best Percent",
	chartDataRelevantFields: ["levelNum"],
	scoreValidators: [
		(s) => {
			if (s.scoreData.lamp === "ALL PERFECT+" && s.scoreData.percent !== 101) {
				return "Cannot have an ALL PERFECT+ without 101%.";
			}

			if (s.scoreData.lamp !== "ALL PERFECT+" && s.scoreData.percent === 101) {
				return "A score of 101% should be an ALL PERFECT+";
			}

			if (s.scoreData.lamp === "ALL PERFECT" && s.scoreData.percent < 100.5) {
				return "Cannot have an ALL PERFECT without at least 100.5%.";
			}

			if (s.scoreData.lamp === "CLEAR" && s.scoreData.percent < 80) {
				return "Cannot have a CLEAR without at least 80%.";
			}

			if (s.scoreData.lamp === "FAILED" && s.scoreData.percent >= 80) {
				return "Cannot have a FAILED if the score is above 80%.";
			}
		},
		(s) => {
			const { great, good, miss } = s.scoreData.judgements;

			// Assume the lamp is correct if judgements aren't provided.
			if (IsNullish(great) || IsNullish(good) || IsNullish(miss)) {
				return;
			}

			if (s.scoreData.lamp === "ALL PERFECT+" && great + good + miss > 0) {
				return "Cannot have an ALL PERFECT+ with any non-perfect judgements.";
			}

			if (s.scoreData.lamp === "ALL PERFECT" && great + good + miss > 0) {
				return "Cannot have an ALL PERFECT with any non-perfect judgements.";
			}

			if (s.scoreData.lamp === "FULL COMBO+" && good + miss > 0) {
				return "Cannot have a FULL COMBO+ with any goods or misses.";
			}

			if (s.scoreData.lamp === "FULL COMBO" && miss > 0) {
				return "Cannot have a FULL COMBO with any misses.";
			}
		},
		(s) => {
			const { maxCombo } = s.scoreData.optional;
			const { pcrit, perfect, great, good, miss } = s.scoreData.judgements;

			if (
				IsNullish(maxCombo) ||
				IsNullish(pcrit) ||
				IsNullish(perfect) ||
				IsNullish(great) ||
				IsNullish(good) ||
				IsNullish(miss)
			) {
				return;
			}

			if (
				s.scoreData.lamp !== "CLEAR" &&
				s.scoreData.lamp !== "FAILED" &&
				pcrit + perfect + great + good + miss !== maxCombo
			) {
				const article = s.scoreData.lamp.startsWith("ALL PERFECT") ? "an" : "a";

				return `Cannot have ${article} ${s.scoreData.lamp} if maxCombo is not equal to the sum of judgements.`;
			}
		},
	],
};
