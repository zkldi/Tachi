import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { PolarisChordPaSkill } from "rg-stats";
import { GetGrade, POCO_GBOUNDARIES } from "tachi-common";

export const POLARISCHORD_IMPL: GameImplementation<"poco"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(POCO_GBOUNDARIES, scoreData.percent),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		paSkill: PolarisChordPaSkill.calculate(scoreData.percent, chart.levelNum),
	}),
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.percent,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => {
		const rate = SessionAvgBest10For("paSkill")(arr);
		return {
			paSkill: rate !== null ? Number(rate.toFixed(5)) : null,
		};
	},
	profileCalcs: async (game, userID) => {
		const rate = await ProfileAvgBestN("paSkill", 30)(game, userID);
		return {
			paSkill: rate !== null ? Number(rate.toFixed(5)) : null,
		};
	},
	classDerivers: (ratings) => {
		const rate = ratings.paSkill;

		if (IsNullish(rate)) {
			return { colour: null };
		}

		if (rate >= 16.0) {
			return { colour: "RAINBOW" };
		}
		if (rate >= 15.5) {
			return { colour: "NAVY" };
		}
		if (rate >= 15.0) {
			return { colour: "PURPLE" };
		}
		if (rate >= 14.0) {
			return { colour: "RED" };
		}
		if (rate >= 13.0) {
			return { colour: "CORAL" };
		}
		if (rate >= 12.0) {
			return { colour: "ORANGE" };
		}
		if (rate >= 11.0) {
			return { colour: "LEMON" };
		}
		if (rate >= 9.0) {
			return { colour: "CYAN" };
		}
		if (rate >= 6.0) {
			return { colour: "BLUE" };
		}
		if (rate >= 3.0) {
			return { colour: "LIME" };
		}
		if (rate >= 1.0) {
			return { colour: "GREEN" };
		}

		return { colour: "GRAY" };
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
			const opt = s.scoreData.optional;
			if (opt) {
				if (
					opt.fast === undefined &&
					opt.fastBad !== undefined &&
					opt.fastBad !== null &&
					opt.fastGood !== undefined &&
					opt.fastGood !== null &&
					opt.fastGreat !== undefined &&
					opt.fastGreat !== null
				) {
					opt.fast = opt.fastBad + opt.fastGood + opt.fastGreat;
				}
				if (
					opt.slow === undefined &&
					opt.slowBad !== undefined &&
					opt.slowBad !== null &&
					opt.slowGood !== undefined &&
					opt.slowGood !== null &&
					opt.slowGreat !== undefined &&
					opt.slowGreat !== null
				) {
					opt.slow = opt.slowBad + opt.slowGood + opt.slowGreat;
				}
			}
			return undefined;
		},
		(s) => {
			if (s.scoreData.lamp === "ALL PERFECT" && s.scoreData.percent !== 100) {
				return `ALL PERFECT scores must have a 100% percent. Got ${s.scoreData.percent} instead.`;
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
		},
		(s) => {
			const { miss, bad, good, great } = s.scoreData.judgements;

			if (s.scoreData.lamp === "ALL PERFECT") {
				const mistakes = (miss ?? 0) + (bad ?? 0) + (good ?? 0) + (great ?? 0);

				if (mistakes > 0) {
					return "Cannot have an ALL PERFECT if all judgements were not perfect.";
				}
			}
		},
	],
};
