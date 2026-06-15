import { type GameImplementation } from "#game-implementations/types";
import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileSumBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { GITADORASkill } from "rg-stats";
import { GetGrade, GITADORA_GBOUNDARIES } from "tachi-common";

const GITADORA_IMPL: GameImplementation<"gitadora-dora" | "gitadora-gita"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(GITADORA_GBOUNDARIES, scoreData.percent),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		skill: GITADORASkill.calculate(scoreData.percent, chart.levelNum),
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
		skill: SessionAvgBest10For("skill")(arr),
	}),
	profileCalcs: async (game, userID) => ({
		naiveSkill: await ProfileSumBestN("skill", 50)(game, userID),
	}),
	classDerivers: (ratings) => {
		const sk = ratings.naiveSkill;

		if (IsNullish(sk)) {
			return { colour: null };
		}

		if (sk >= 8500) {
			return { colour: "RAINBOW" };
		} else if (sk >= 8000) {
			return { colour: "GOLD" };
		} else if (sk >= 7500) {
			return { colour: "SILVER" };
		} else if (sk >= 7000) {
			return { colour: "BRONZE" };
		} else if (sk >= 6500) {
			return { colour: "RED_GRD" };
		} else if (sk >= 6000) {
			return { colour: "RED" };
		} else if (sk >= 5500) {
			return { colour: "PURPLE_GRD" };
		} else if (sk >= 5000) {
			return { colour: "PURPLE" };
		} else if (sk >= 4500) {
			return { colour: "BLUE_GRD" };
		} else if (sk >= 4000) {
			return { colour: "BLUE" };
		} else if (sk >= 3500) {
			return { colour: "GREEN_GRD" };
		} else if (sk >= 3000) {
			return { colour: "GREEN" };
		} else if (sk >= 2500) {
			return { colour: "YELLOW_GRD" };
		} else if (sk >= 2000) {
			return { colour: "YELLOW" };
		} else if (sk >= 1500) {
			return { colour: "ORANGE_GRD" };
		} else if (sk >= 1000) {
			return { colour: "ORANGE" };
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
	scoreValidators: [],
	chartDataRelevantFields: ["levelNum"],
};

export const GITADORA_GITA_IMPL: GameImplementation<"gitadora-gita"> = GITADORA_IMPL;

export const GITADORA_DORA_IMPL: GameImplementation<"gitadora-dora"> = GITADORA_IMPL;
