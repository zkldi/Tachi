import type { GameImplementation } from "#game-implementations/types";
import type { GetEnumValue } from "tachi-common/types/metrics";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { PopnClassPoints } from "rg-stats";
import { GetGrade, POPN_GBOUNDARIES } from "tachi-common";

export function PopnClearMedalToLamp(
	clearMedal: GetEnumValue<"popn", "clearMedal">,
): GetEnumValue<"popn", "lamp"> {
	switch (clearMedal) {
		case "perfect":
			return "PERFECT";
		case "fullComboCircle":
		case "fullComboDiamond":
		case "fullComboStar":
			return "FULL COMBO";
		case "clearCircle":
		case "clearDiamond":
		case "clearStar":
			return "CLEAR";
		case "easyClear":
			return "EASY CLEAR";
		case "failedCircle":
		case "failedDiamond":
		case "failedStar":
			return "FAILED";
	}
}

export const POPN_IMPL: GameImplementation<"popn"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => {
		const lamp = PopnClearMedalToLamp(scoreData.clearMedal);

		return {
			lamp,
			grade:
				scoreData.score >= 90_000 && lamp === "FAILED"
					? "A"
					: GetGrade(POPN_GBOUNDARIES, scoreData.score),
		};
	},
	scoreCalcs: (scoreData, derivedData, chart) => ({
		classPoints: PopnClassPoints.calculate(scoreData.score, derivedData.lamp, chart.levelNum),
	}),
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.clearMedal,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => ({
		classPoints: SessionAvgBest10For("classPoints")(arr),
	}),
	profileCalcs: async (game, userID) => ({
		naiveClassPoints: await ProfileAvgBestN("classPoints", 20)(game, userID),
	}),
	classDerivers: (ratings) => {
		const points = ratings.naiveClassPoints;

		if (IsNullish(points)) {
			return { class: null };
		}

		if (points < 21) {
			return { class: "KITTY" };
		} else if (points < 34) {
			return { class: "STUDENT" };
		} else if (points < 46) {
			return { class: "DELINQUENT" };
		} else if (points < 59) {
			return { class: "DETECTIVE" };
		} else if (points < 68) {
			return { class: "IDOL" };
		} else if (points < 79) {
			return { class: "GENERAL" };
		} else if (points < 91) {
			return { class: "HERMIT" };
		}

		return { class: "GOD" };
	},
	pbMergeFunctions: [
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "clearMedal" },
			"Best Clear",
			(base, score) => {
				base.scoreData.clearMedal = score.scoreData.clearMedal;
				// these are directly related. pluck both.
				base.scoreData.lamp = score.scoreData.lamp;
			},
		),
	],
	defaultMergeRefName: "Best Score",
	chartDataRelevantFields: ["levelNum"],
	scoreValidators: [
		(s) => {
			const { bad, good } = s.scoreData.judgements;

			if (s.scoreData.lamp === "PERFECT") {
				const mistakes = (bad ?? 0) + (good ?? 0);

				if (mistakes > 0) {
					return "Cannot have a PERFECT lamp with any bads or goods.";
				}
			} else if (s.scoreData.lamp === "FULL COMBO") {
				const mistakes = bad ?? 0;

				if (mistakes > 0) {
					return "Cannot have a FULL COMBO lamp with any bads.";
				}
			}
		},
		// clear medal bad/good checks.
		(s) => {
			const { bad, good } = s.scoreData.judgements;

			if (IsNullish(bad) || IsNullish(good)) {
				return;
			}

			switch (s.scoreData.clearMedal) {
				case "fullComboStar": {
					if (good > 5 || good < 1) {
						return "Must have between 1-5 goods for a full combo star.";
					}

					break;
				}

				case "fullComboDiamond": {
					if (good > 20 || good < 6) {
						return "Must have between 6-20 goods for a full combo diamond.";
					}

					break;
				}

				case "fullComboCircle": {
					if (good < 21) {
						return "Must have >21 goods for a full combo circle.";
					}

					break;
				}

				case "clearStar": {
					if (bad > 5 || bad < 1) {
						return "Must have between 1-5 bads for a clear star.";
					}

					break;
				}

				case "clearDiamond": {
					if (bad > 20 || bad < 6) {
						return "Must have between 6-20 bads for a clear diamond.";
					}

					break;
				}

				case "clearCircle": {
					if (bad < 21) {
						return "Must have between >21 bads for a clear circle.";
					}

					break;
				}

				// can't validate the fails since we don't have the gauge info.
				default:
			}
		},
	],
};
