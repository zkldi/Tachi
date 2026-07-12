import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { CuratorSkill } from "rg-stats";
import { GetGrade, MUSECA_GBOUNDARIES } from "tachi-common";

export const MUSECA_IMPL: GameImplementation<"museca"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(MUSECA_GBOUNDARIES, scoreData.score),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		curatorSkill: CuratorSkill.calculate(scoreData.score, chart.levelNum),
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
		curatorSkill: SessionAvgBest10For("curatorSkill")(arr),
	}),
	profileCalcs: async (game, userID) => ({
		curatorSkill: await ProfileSumBestN("curatorSkill", 20)(game, userID),
	}),
	classDerivers: (_ratings) => ({}),
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
			if (s.scoreData.lamp === "PERFECT CONNECT ALL" && s.scoreData.score !== 1_000_000) {
				return "A PERFECT CONNECT ALL must have a score of 1 million.";
			}

			if (s.scoreData.score === 1_000_000 && s.scoreData.lamp !== "PERFECT CONNECT ALL") {
				return "A perfect score of 1 million must have a lamp of PERFECT CONNECT ALL.";
			}
		},
		(s) => {
			let { miss, near } = s.scoreData.judgements;

			miss ??= 0;
			near ??= 0;

			if (s.scoreData.lamp === "PERFECT CONNECT ALL" && miss + near > 0) {
				return "Cannot have a PERFECT CONNECT ALL with any nears or misses.";
			}

			if (s.scoreData.lamp === "CONNECT ALL" && miss > 0) {
				return "Cannot have a CONNECT ALL with any misses.";
			}
		},
		(s) => {
			if (s.scoreData.score < 800_000 && s.scoreData.lamp !== "FAILED") {
				return "A score of <800k must be a fail.";
			}

			if (s.scoreData.score >= 800_000 && s.scoreData.lamp === "FAILED") {
				return "A score of >=800k must be a clear.";
			}
		},
	],
};
