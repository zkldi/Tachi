import type { GameImplementation, PBMergeFunction } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { type BMSGames } from "tachi-common";

import {
	IIDXLIKE_PB_RANKING_VALUES,
	IIDXLIKE_SCORE_DERIVER,
	IIDXLIKE_SCORE_VALIDATORS,
	IIDXLIKE_VALIDATORS,
	SGL_PROFILE_CALCS,
	SGL_SCORE_CALCS,
	SGL_SESSION_CALCS,
} from "./_common";

const BMS_PMS_MERGERS: Array<PBMergeFunction<BMSGames>> = [
	CreatePBMergeFor("largest", { type: "REGULAR", metric: "lamp" }, "Best Lamp", (base, lamp) => {
		base.scoreData.lamp = lamp.scoreData.lamp;

		// technically these don't exist on PMS scores but since undefined is a
		// legal value for these properties it works out.
		base.scoreData.optional.gauge = lamp.scoreData.optional.gauge;
		base.scoreData.optional.gaugeHistory = lamp.scoreData.optional.gaugeHistory;
		base.scoreData.optional.gaugeHistoryEasy = lamp.scoreData.optional.gaugeHistoryEasy;
		base.scoreData.optional.gaugeHistoryGroove = lamp.scoreData.optional.gaugeHistoryGroove;
		base.scoreData.optional.gaugeHistoryHard = lamp.scoreData.optional.gaugeHistoryHard;
	}),
	CreatePBMergeFor("smallest", { type: "REGULAR", metric: "bp" }, "Lowest BP", (base, bp) => {
		base.scoreData.optional.bp = bp.scoreData.optional.bp;
	}),
];

// bms and pms currently have *identical*
// implementations. Nice.

const BMS_IMPL: GameImplementation<BMSGames> = {
	scoreDeriver: IIDXLIKE_SCORE_DERIVER,
	scoreCalcs: SGL_SCORE_CALCS,
	sessionCalcs: SGL_SESSION_CALCS,
	profileCalcs: SGL_PROFILE_CALCS,
	classDerivers: (_ratings) => ({}),
	chartSpecificValidators: IIDXLIKE_VALIDATORS,
	pbRankingValues: IIDXLIKE_PB_RANKING_VALUES,
	pbMergeFunctions: BMS_PMS_MERGERS,
	defaultMergeRefName: "Best Score",
	scoreValidators: IIDXLIKE_SCORE_VALIDATORS,
	chartDataRelevantFields: ["data.notecount", "data.sglEC", "data.sglHC"],
};

export const BMS_14K_IMPL: GameImplementation<"bms-14k"> = BMS_IMPL;

export const BMS_7K_IMPL: GameImplementation<"bms-7k"> = BMS_IMPL;

export const PMS_CONTROLLER_IMPL: GameImplementation<"pms-controller"> = BMS_IMPL;
export const PMS_KEYBOARD_IMPL: GameImplementation<"pms-keyboard"> = BMS_IMPL;
