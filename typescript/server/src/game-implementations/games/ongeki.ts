import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { ONGEKIRating } from "rg-stats";
import { type ChartDocument, GetGrade, ONGEKI_GBOUNDARIES } from "tachi-common";
import { StarEnumToInt } from "tachi-common/config/game-support/ongeki";

const isUnranked = (chart: ChartDocument<"ongeki">) => {
	const ig = chart.data.inGameID;
	return (ig !== null && ig >= 7000 && ig < 8000) || chart.levelNum === 0.0;
};

const starCount = (platinumScore: number, maxPlatinumScore: number) => {
	const pct = Math.floor((platinumScore / maxPlatinumScore) * 100);

	const v = Math.max(0, Math.min(pct, 99) - 93);
	switch (v) {
		case 0:
			return "0-star";
		case 1:
			return "1-star";
		case 2:
			return "2-star";
		case 3:
			return "3-star";
		case 4:
			return "4-star";
		case 5:
			return "5-star";
		case 6:
			return "R-star";
		default:
			throw new Error("Invalid star count");
	}
};

export const ONGEKI_IMPL: GameImplementation<"ongeki"> = {
	chartSpecificValidators: {
		bellCount: (bellCount) => {
			if (bellCount < 0) {
				return `Bell Count must be non-negative. Got ${bellCount}`;
			}

			return true;
		},
		totalBellCount: (bellCount) => {
			if (bellCount < 0) {
				return `Total bell Count must be non-negative. Got ${bellCount}`;
			}

			return true;
		},
		damage: (damage) => {
			if (damage < 0) {
				return `Damage must be non-negative. Got ${damage}`;
			}

			return true;
		},
		platinumScore: (platinumScore, chart) => {
			if (platinumScore < 0) {
				return `Platinum Score must be non-negative. Got ${platinumScore}`;
			}

			if (platinumScore > chart.data.maxPlatScore) {
				return `Platinum Score must not exceed the chart's maximum Platinum Score. Got ${platinumScore}/${chart.data.maxPlatScore}`;
			}

			return true;
		},
	},
	scoreDeriver: (scoreData, chart) => ({
		grade: GetGrade(ONGEKI_GBOUNDARIES, scoreData.score),
		platinumStars: starCount(scoreData.platinumScore, chart.data.maxPlatScore),
	}),
	scoreCalcs: (scoreData, derivedData, chart) => {
		if (isUnranked(chart)) {
			return { rating: 0, scoreRating: 0, starRating: 0 };
		}

		return {
			rating: ONGEKIRating.calculate(scoreData.score, chart.levelNum),
			scoreRating: ONGEKIRating.calculateRefresh(
				chart.levelNum,
				scoreData.score,
				scoreData.noteLamp,
				scoreData.bellLamp === "FULL BELL",
			),
			starRating: ONGEKIRating.calculatePlatinum(
				chart.levelNum,
				StarEnumToInt(derivedData.platinumStars),
			),
		};
	},
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.platinumScore,
		tb2: pb.scoreData.enumIndexes.noteLamp,
		tb3: pb.scoreData.enumIndexes.bellLamp,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => ({
		naiveRating: SessionAvgBest10For("rating")(arr),
		naiveScoreRating: SessionAvgBest10For("scoreRating")(arr),
		starRating: SessionAvgBest10For("starRating")(arr),
	}),
	profileCalcs: async (game, userID) => {
		const [naiveRating, scoreRating, starRating] = await Promise.all([
			ProfileAvgBestN("rating", 45, false, 100)(game, userID),
			ProfileAvgBestN("scoreRating", 60, false, 1000)(game, userID),
			ProfileAvgBestN("starRating", 50, false, 1000)(game, userID),
		]);

		const score1k = Math.round((scoreRating ?? 0) * 1000);
		const star1k = Math.round((starRating ?? 0) * 1000);
		const naiveRatingRefresh = (Math.floor(score1k * 1.2) + star1k) / 1000.0;

		return { naiveRating, naiveRatingRefresh, scoreRating, starRating };
	},
	classDerivers: (ratings) => {
		const rating = ratings.naiveRatingRefresh;

		if (IsNullish(rating)) {
			return { colour: null };
		}

		if (rating >= 22) {
			return { colour: "RAINBOW_EX_TRUE" };
		} else if (rating >= 21) {
			return { colour: "RAINBOW_EX" };
		} else if (rating >= 20) {
			return { colour: "RAINBOW_SHINY" };
		} else if (rating >= 19) {
			return { colour: "RAINBOW" };
		} else if (rating >= 18) {
			return { colour: "PLATINUM" };
		} else if (rating >= 17) {
			return { colour: "GOLD" };
		} else if (rating >= 15) {
			return { colour: "SILVER" };
		} else if (rating >= 13) {
			return { colour: "COPPER" };
		} else if (rating >= 11) {
			return { colour: "PURPLE" };
		} else if (rating >= 9) {
			return { colour: "RED" };
		} else if (rating >= 7) {
			return { colour: "ORANGE" };
		} else if (rating >= 4) {
			return { colour: "GREEN" };
		}

		return { colour: "BLUE" };
	},
	pbMergeFunctions: [
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "platinumScore" },
			"Best Platinum Score",
			(base, score) => {
				base.scoreData.platinumScore = score.scoreData.platinumScore;
				base.scoreData.platinumStars = score.scoreData.platinumStars;
			},
		),
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "noteLamp" },
			"Best Note Lamp",
			(base, score) => {
				base.scoreData.noteLamp = score.scoreData.noteLamp;
			},
		),
		CreatePBMergeFor(
			"largest",
			{ type: "REGULAR", metric: "bellLamp" },
			"Best Bell Lamp",
			(base, score) => {
				base.scoreData.bellLamp = score.scoreData.bellLamp;
			},
		),
	],
	defaultMergeRefName: "Best Score",
	chartDataRelevantFields: ["levelNum", "data.maxPlatScore", "data.inGameID"],
	scoreValidators: [
		(s, chart) => {
			let { hit, miss } = s.scoreData.judgements;
			let rbreak = s.scoreData.judgements.break;

			hit ??= 0;
			miss ??= 0;
			rbreak ??= 0;

			if (s.scoreData.noteLamp === "ALL BREAK+") {
				if (hit + miss + rbreak > 0) {
					return "Cannot have an ALL BREAK+ if not all hits were critical break or better.";
				}

				if (s.scoreData.score < 1010000) {
					return "Cannot have an ALL BREAK+ if the score is not 1,010,000";
				}
			}

			if (
				s.scoreData.score === 1010000 &&
				(s.scoreData.noteLamp !== "ALL BREAK+" || s.scoreData.bellLamp !== "FULL BELL")
			) {
				return "Cannot have a perfect score without FBAB+";
			}

			if (s.scoreData.noteLamp === "ALL BREAK") {
				if (hit + miss > 0) {
					return "Cannot have an ALL BREAK if not all hits were break or better.";
				}
			}

			if (s.scoreData.noteLamp === "FULL COMBO") {
				if (miss > 0) {
					return "Cannot have a FULL COMBO if the score has misses.";
				}
			}

			// LMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAO
			// if (s.scoreData.bellLamp === "FULL BELL" && s.scoreData.noteLamp === "LOSS") {
			//		return "Cannot have a LOSS with a FULL BELL.";
			// }
			// LMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAO

			if (s.scoreData.platinumScore > chart.data.maxPlatScore) {
				return `Cannot have ${s.scoreData.platinumScore}/${chart.data.maxPlatScore} Platinum Score.`;
			}
		},
	],
};
