import type { GameImplementation } from "#game-implementations/types";

import {
	SDVXLIKE_CLASS_DERIVERS,
	SDVXLIKE_DEFAULT_MERGE_NAME,
	SDVXLIKE_PB_MERGERS,
	SDVXLIKE_PROFILE_CALCS,
	SDVXLIKE_SCORE_CALCS,
	SDVXLIKE_SCORE_DERIVER,
	SDVXLIKE_SCORE_VALIDATORS,
	SDVXLIKE_SESSION_CALCS,
} from "./_common";

const USC_IMPL: GameImplementation<"usc-controller" | "usc-keyboard"> = {
	scoreDeriver: SDVXLIKE_SCORE_DERIVER,
	scoreCalcs: SDVXLIKE_SCORE_CALCS,
	sessionCalcs: SDVXLIKE_SESSION_CALCS,
	profileCalcs: SDVXLIKE_PROFILE_CALCS,
	classDerivers: SDVXLIKE_CLASS_DERIVERS,
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	chartSpecificValidators: {},
	pbMergeFunctions: SDVXLIKE_PB_MERGERS,
	defaultMergeRefName: SDVXLIKE_DEFAULT_MERGE_NAME,
	scoreValidators: SDVXLIKE_SCORE_VALIDATORS,
	chartDataRelevantFields: ["levelNum"],
};

export const USC_KEYBOARD_IMPL: GameImplementation<"usc-keyboard"> = USC_IMPL;

export const USC_CONTROLLER_IMPL: GameImplementation<"usc-controller"> = USC_IMPL;
