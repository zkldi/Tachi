import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { MaimaiRate } from "rg-stats";
import { GetGrade, MAIMAI_GBOUNDARIES } from "tachi-common";

export const MAIMAI_IMPL: GameImplementation<"maimai"> = {
	chartSpecificValidators: {
		percent: (percent, chart) => {
			if (percent < 0) {
				return "Percent cannot be negative.";
			}

			if (percent > chart.data.maxPercent) {
				return `Percent cannot be greater than ${chart.data.maxPercent} for this chart.`;
			}

			return true;
		},
	},
	scoreDeriver: (scoreData, chart) => ({
		grade:
			scoreData.percent === chart.data.maxPercent
				? "SSS+"
				: GetGrade(MAIMAI_GBOUNDARIES, scoreData.percent),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		rate: MaimaiRate.calculate(scoreData.percent, chart.data.maxPercent, chart.levelNum),
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
		naiveRate: await ProfileAvgBestN("rate", 30)(game, userID),
	}),
	classDerivers: (ratings) => {
		const rate = ratings.naiveRate;

		if (IsNullish(rate)) {
			return { colour: null };
		}

		if (rate >= 15) {
			return { colour: "RAINBOW" };
		} else if (rate >= 14.5) {
			return { colour: "GOLD" };
		} else if (rate >= 14) {
			return { colour: "SILVER" };
		} else if (rate >= 13) {
			return { colour: "BRONZE" };
		} else if (rate >= 12) {
			return { colour: "PURPLE" };
		} else if (rate >= 10) {
			return { colour: "RED" };
		} else if (rate >= 7) {
			return { colour: "YELLOW" };
		} else if (rate >= 4) {
			return { colour: "GREEN" };
		} else if (rate >= 2) {
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
	chartDataRelevantFields: ["levelNum", "data.maxPercent"],
	scoreValidators: [
		(s) => {
			if (s.scoreData.percent > 104) {
				return "Score cannot be greater than 104%.";
			}
		},
		(s) => {
			if (s.scoreData.lamp === "ALL PERFECT+" && !(s.scoreData.grade === "SSS+")) {
				return "Cannot have an ALL PERFECT+ without grade SSS+.";
			}

			if (s.scoreData.grade === "SSS+" && !(s.scoreData.lamp === "ALL PERFECT+")) {
				return "Cannot have grade SSS+ without an ALL PERFECT+";
			}
		},
		(s) => {
			let { great, good, miss } = s.scoreData.judgements;

			great ??= 0;
			good ??= 0;
			miss ??= 0;

			if (s.scoreData.lamp === "ALL PERFECT") {
				// `great`, `good` and `miss` are all coalesced to 0, so they're all
				// numbers, even if eslint doesn't think so.

				if (great + good + miss > 0) {
					return "Cannot have an ALL PERFECT with any non-perfect judgements.";
				}
			}

			if (s.scoreData.lamp === "FULL COMBO") {
				if (miss > 0) {
					return "Cannot have a FULL COMBO if the score has misses.";
				}
			}
		},
	],
};
