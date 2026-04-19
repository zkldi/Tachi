/* eslint-disable no-confusing-arrow */
import { GoalFmtScore, GoalOutOfFmtScore, GradeGoalFormatter } from "./_common";
import { CreatePBMergeFor } from "game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "game-implementations/utils/session-calc";
import { ONGEKIRating } from "rg-stats";
import { ONGEKI_GBOUNDARIES, FmtNum, GetGrade, FmtStars, FmtStarsCompact } from "tachi-common";
import { IsNullish } from "utils/misc";
import type { GPTServerImplementation } from "game-implementations/types";
import type { ChartDocument, Game, integer, Playtype } from "tachi-common";

const isUnranked = (chart: ChartDocument<"ongeki:Single">) =>
	chart.data.isBonusTrack || chart.levelNum === 0.0;

const starCount = (platinumScore: number, maxPlatinumScore: number) => {
	const pct = Math.floor((platinumScore / maxPlatinumScore) * 100);

	return Math.max(0, Math.min(pct, 99) - 93);
};

export const ONGEKI_IMPL: GPTServerImplementation<"ongeki:Single"> = {
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
	derivers: {
		grade: ({ score }) => GetGrade(ONGEKI_GBOUNDARIES, score),
		platinumStars: ({ platinumScore }, chart) =>
			starCount(platinumScore, chart.data.maxPlatScore),
	},
	scoreCalcs: {
		rating: (scoreData, chart) =>
			isUnranked(chart) ? 0 : ONGEKIRating.calculate(scoreData.score, chart.levelNum),
		scoreRating: (scoreData, chart) =>
			isUnranked(chart)
				? 0
				: ONGEKIRating.calculateRefresh(
						chart.levelNum,
						scoreData.score,
						scoreData.score === 1010000 ? "ALL BREAK+" : scoreData.noteLamp,
						scoreData.bellLamp === "FULL BELL"
				  ),
		starRating: (scoreData, chart) =>
			isUnranked(chart)
				? 0
				: ONGEKIRating.calculatePlatinum(
						chart.levelNum,
						starCount(scoreData.platinumScore, chart.data.maxPlatScore)
				  ),
	},
	sessionCalcs: {
		naiveRating: SessionAvgBest10For("rating"),
		naiveScoreRating: SessionAvgBest10For("scoreRating"),
		starRating: SessionAvgBest10For("starRating"),
	},
	profileCalcs: {
		naiveRating: ProfileAvgBestN("rating", 45, false, 100),
		naiveRatingRefresh: async (game: Game, playtype: Playtype, userID: integer) => {
			const [score, star] = await Promise.all([
				ProfileAvgBestN("scoreRating", 60, false, 1000)(game, playtype, userID),
				ProfileAvgBestN("starRating", 50, false, 1000)(game, playtype, userID),
			]);

			const score1k = Math.round((score ?? 0) * 1000);
			const star1k = Math.round((star ?? 0) * 1000);

			return (Math.floor(score1k * 1.2) + star1k) / 1000.0;
		},
	},
	classDerivers: {
		colour: (ratings) => {
			const rating = ratings.naiveRatingRefresh;

			if (IsNullish(rating)) {
				return null;
			}

			if (rating >= 22) {
				return "RAINBOW_EX_TRUE";
			} else if (rating >= 21) {
				return "RAINBOW_EX";
			} else if (rating >= 20) {
				return "RAINBOW_SHINY";
			} else if (rating >= 19) {
				return "RAINBOW";
			} else if (rating >= 18) {
				return "PLATINUM";
			} else if (rating >= 17) {
				return "GOLD";
			} else if (rating >= 15) {
				return "SILVER";
			} else if (rating >= 13) {
				return "COPPER";
			} else if (rating >= 11) {
				return "PURPLE";
			} else if (rating >= 9) {
				return "RED";
			} else if (rating >= 7) {
				return "ORANGE";
			} else if (rating >= 4) {
				return "GREEN";
			}

			return "BLUE";
		},
	},
	goalCriteriaFormatters: {
		score: GoalFmtScore,
		platinumScore: (val: number) => `Get ${val.toLocaleString("en-GB")} Platinum Score on`,
		platinumStars: (val: number) => `Get ${FmtStars(val)} on`,
	},
	goalProgressFormatters: {
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				ONGEKI_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				ONGEKI_GBOUNDARIES[gradeIndex]?.name ?? "D"
			),
		noteLamp: (pb) => pb.scoreData.noteLamp,
		bellLamp: (pb) => pb.scoreData.bellLamp,
		score: (pb) => FmtNum(pb.scoreData.score),
		platinumScore: (pb) => FmtNum(pb.scoreData.platinumScore),
		platinumStars: (pb) => FmtStarsCompact(pb.scoreData.platinumStars),
	},
	goalOutOfFormatters: {
		score: GoalOutOfFmtScore,
		platinumScore: GoalOutOfFmtScore,
		platinumStars: () => FmtStarsCompact(6),
	},
	pbMergeFunctions: [
		CreatePBMergeFor("largest", "platinumScore", "Best Platinum Score", (base, score) => {
			base.scoreData.platinumScore = score.scoreData.platinumScore;
			base.scoreData.platinumStars = score.scoreData.platinumStars;
		}),
		CreatePBMergeFor("largest", "enumIndexes.noteLamp", "Best Note Lamp", (base, score) => {
			base.scoreData.noteLamp = score.scoreData.noteLamp;
		}),
		CreatePBMergeFor("largest", "enumIndexes.bellLamp", "Best Bell Lamp", (base, score) => {
			base.scoreData.bellLamp = score.scoreData.bellLamp;
		}),
	],
	defaultMergeRefName: "Best Score",
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

			if (s.scoreData.bellLamp === "FULL BELL" && s.scoreData.noteLamp === "LOSS") {
				return "Cannot have a LOSS with a FULL BELL.";
			}

			if (s.scoreData.platinumScore > chart.data.maxPlatScore) {
				return `Cannot have ${s.scoreData.platinumScore}/${chart.data.maxPlatScore} Platinum Score.`;
			}
		},
	],
};
