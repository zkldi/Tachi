import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";

import {
	SDVXLIKE_CLASS_DERIVERS,
	SDVXLIKE_DEFAULT_MERGE_NAME,
	SDVXLIKE_PROFILE_CALCS,
	SDVXLIKE_SCORE_CALCS,
	SDVXLIKE_SCORE_DERIVER,
	SDVXLIKE_SCORE_VALIDATORS,
	SDVXLIKE_SESSION_CALCS,
} from "./_common";

export const SDVX_IMPL: GameImplementation<"sdvx"> = {
	scoreDeriver: SDVXLIKE_SCORE_DERIVER,
	scoreCalcs: SDVXLIKE_SCORE_CALCS,
	sessionCalcs: SDVXLIKE_SESSION_CALCS,
	profileCalcs: SDVXLIKE_PROFILE_CALCS,
	classDerivers: SDVXLIKE_CLASS_DERIVERS,
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: pb.scoreData.optional.exScore ?? null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	chartSpecificValidators: {
		exScore: (exScore, chart) => {
			if (exScore < 0) {
				return `EX Score must be non-negative. Got ${exScore}`;
			}

			// TODO
			// gotta figure this out somehow?
			// we need to store notecounts or something. For now, just allow
			// any +ve integer, I guess.

			return true;
		},
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
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "exScore" },
			"Best EX Score",
			(base, score) => {
				base.scoreData.optional.exScore = score.scoreData.optional.exScore;
			},
		),
	],
	defaultMergeRefName: SDVXLIKE_DEFAULT_MERGE_NAME,
	scoreValidators: SDVXLIKE_SCORE_VALIDATORS,
	chartDataRelevantFields: ["levelNum"],
};
