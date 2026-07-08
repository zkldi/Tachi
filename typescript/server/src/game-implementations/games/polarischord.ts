import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { PolarisChordSkill } from "rg-stats";

// 100% ACHIEVEMENT RATE is a SSS+ lamp but has its own rank
const POLARISCHORD_GBOUNDARIES: Array<[string, number]> = [
	["AP", 100.0],
	["SSS+", 99.5],
	["SSS", 99.0],
	["SS", 98.5],
	["S", 98.0],
	["AAA", 95.0],
	["AA", 90.0],
	["A", 85.0],
	["B", 80.0],
	["C", 70.0],
	["D", 0],
];

function getGrade(score: number): string {
	for (const [grade, req] of POLARISCHORD_GBOUNDARIES) {
		if (score >= req) {
			return grade;
		}
	}
	return "D";
}


export const POLARISCHORD_IMPL: GameImplementation<"polarischord"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: getGrade(scoreData.percent),
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

		if (rate >= 16.00) return { colour: "RAINBOW" };
		if (rate >= 15.50) return { colour: "NAVY" };
		if (rate >= 15.00) return { colour: "PURPLE" };
		if (rate >= 14.00) return { colour: "RED" };
		if (rate >= 13.00) return { colour: "CORAL" };
		if (rate >= 12.00) return { colour: "ORANGE" };
		if (rate >= 11.00) return { colour: "LEMON" };
		if (rate >= 9.00) return { colour: "CYAN" };
		if (rate >= 6.00) return { colour: "BLUE" };
		if (rate >= 3.00) return { colour: "LIME" };
		if (rate >= 1.00) return { colour: "GREEN" };

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
				if (opt.fast === undefined && opt.fastBad !== undefined && opt.fastGood !== undefined && opt.fastGreat !== undefined) {
					opt.fast = opt.fastBad + opt.fastGood + opt.fastGreat;
				}
				if (opt.slow === undefined && opt.slowBad !== undefined && opt.slowGood !== undefined && opt.slowGreat !== undefined) {
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
