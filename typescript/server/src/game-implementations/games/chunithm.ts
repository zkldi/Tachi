import type { GameImplementation } from "#game-implementations/types";

import { CreatePBMergeFor } from "#game-implementations/utils/pb-merge";
import { ProfileAvgBestN } from "#game-implementations/utils/profile-calc";
import { SessionAvgBest10For } from "#game-implementations/utils/session-calc";
import { IsNullish } from "#utils/misc";
import { CHUNITHMRating } from "rg-stats";
import { CHUNITHM_GBOUNDARIES, FmtNum, GetGrade } from "tachi-common";

import { GoalFmtScore, GoalOutOfFmtScore, GradeGoalFormatter } from "./_common";

export const CHUNITHM_IMPL: GameImplementation<"chunithm"> = {
	chartSpecificValidators: {},
	scoreDeriver: (scoreData, _chart) => ({
		grade: GetGrade(CHUNITHM_GBOUNDARIES, scoreData.score),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => ({
		rating: chart.levelNum > 0 ? CHUNITHMRating.calculate(scoreData.score, chart.levelNum) : 0,
	}),
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.noteLamp,
		tb2: pb.scoreData.enumIndexes.clearLamp,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
	sessionCalcs: (arr) => ({
		naiveRating: SessionAvgBest10For("rating")(arr),
	}),
	profileCalcs: async (game, userID) => ({
		naiveRating: await ProfileAvgBestN("rating", 50, false, 100)(game, userID),
	}),
	classDerivers: (ratings) => {
		const rating = ratings.naiveRating;

		if (IsNullish(rating)) {
			return { colour: null };
		}

		if (rating >= 17.5) {
			return { colour: "RAINBOW_EX_III" };
		} else if (rating >= 17.25) {
			return { colour: "RAINBOW_EX_II" };
		} else if (rating >= 17) {
			return { colour: "RAINBOW_EX_I" };
		} else if (rating >= 16.75) {
			return { colour: "RAINBOW_IV" };
		} else if (rating >= 16.5) {
			return { colour: "RAINBOW_III" };
		} else if (rating >= 16.25) {
			return { colour: "RAINBOW_II" };
		} else if (rating >= 16) {
			return { colour: "RAINBOW" };
		} else if (rating >= 15.75) {
			return { colour: "PLATINUM_III" };
		} else if (rating >= 15.5) {
			return { colour: "PLATINUM_II" };
		} else if (rating >= 15.25) {
			return { colour: "PLATINUM" };
		} else if (rating >= 14.5) {
			return { colour: "GOLD" };
		} else if (rating >= 13.25) {
			return { colour: "SILVER" };
		} else if (rating >= 12) {
			return { colour: "COPPER" };
		} else if (rating >= 10) {
			return { colour: "PURPLE" };
		} else if (rating >= 7) {
			return { colour: "RED" };
		} else if (rating >= 4) {
			return { colour: "ORANGE" };
		} else if (rating >= 2) {
			return { colour: "GREEN" };
		}

		return { colour: "BLUE" };
	},
	goalCriteriaFormatters: {
		score: GoalFmtScore,
	},
	goalProgressFormatters: {
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				CHUNITHM_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				CHUNITHM_GBOUNDARIES[gradeIndex]!.name,
			),
		noteLamp: (pb) => pb.scoreData.noteLamp,
		clearLamp: (pb) => pb.scoreData.clearLamp,
		score: (pb) => FmtNum(pb.scoreData.score),
	},
	goalOutOfFormatters: {
		score: GoalOutOfFmtScore,
	},
	pbMergeFunctions: [
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
			{ type: "REGULAR", metric: "clearLamp" },
			"Best Clear Lamp",
			(base, score) => {
				base.scoreData.clearLamp = score.scoreData.clearLamp;
			},
		),
	],
	defaultMergeRefName: "Best Score",
	chartDataRelevantFields: ["levelNum"],
	scoreValidators: [
		(s) => {
			if (
				s.scoreData.noteLamp === "ALL JUSTICE CRITICAL" &&
				s.scoreData.score !== 1_010_000
			) {
				return "An ALL JUSTICE CRITICAL must have a score of 1.01 million.";
			}

			if (
				s.scoreData.noteLamp !== "ALL JUSTICE CRITICAL" &&
				s.scoreData.score === 1_010_000
			) {
				return "A score of 1.01 million must have a lamp of ALL JUSTICE CRITICAL.";
			}

			if (s.scoreData.noteLamp === "ALL JUSTICE" && s.scoreData.score < 1_000_000) {
				return `A score of ${s.scoreData.score} cannot be an ALL JUSTICE.`;
			}

			if (s.scoreData.noteLamp === "FULL COMBO" && s.scoreData.score < 500_000) {
				return `A score of ${s.scoreData.score} cannot be a FULL COMBO.`;
			}
		},
		(s) => {
			let { attack, justice, miss } = s.scoreData.judgements;

			justice ??= 0;
			attack ??= 0;
			miss ??= 0;

			if (s.scoreData.noteLamp === "ALL JUSTICE CRITICAL") {
				if (attack + justice + miss > 0) {
					return "Cannot have an ALL JUSTICE CRITICAL with any non-jcrit judgements.";
				}
			}

			if (s.scoreData.noteLamp === "ALL JUSTICE") {
				if (attack + miss > 0) {
					return "Cannot have an ALL JUSTICE if not all hits were justice or better.";
				}
			}

			if (s.scoreData.noteLamp === "FULL COMBO") {
				if (miss > 0) {
					return "Cannot have a FULL COMBO if the score has misses.";
				}
			}
		},
		(s) => {
			const { maxCombo } = s.scoreData.optional;
			const { attack, jcrit, justice, miss } = s.scoreData.judgements;

			if (
				IsNullish(maxCombo) ||
				IsNullish(attack) ||
				IsNullish(jcrit) ||
				IsNullish(justice) ||
				IsNullish(miss)
			) {
				return;
			}

			if (s.scoreData.noteLamp !== "NONE" && jcrit + justice + attack + miss !== maxCombo) {
				const article = s.scoreData.noteLamp === "FULL COMBO" ? "a" : "an";

				return `Cannot have ${article} ${s.scoreData.noteLamp} if maxCombo is not equal to the sum of judgements.`;
			}
		},
		(s) => {
			const { attack, justice, miss } = s.scoreData.judgements;

			// Assume the clear lamp is correct if judgements aren't provided.
			if (IsNullish(attack) || IsNullish(justice) || IsNullish(miss)) {
				return;
			}

			if (s.scoreData.clearLamp === "CATASTROPHY" && justice + attack + miss >= 10) {
				return "Cannot have a CATASTROPHY clear with 10 or more non-jcrit judgements.";
			}

			if (s.scoreData.clearLamp === "ABSOLUTE" && justice + attack + miss >= 50) {
				return "Cannot have an ABSOLUTE clear with 50 or more non-jcrit judgements.";
			}

			if (s.scoreData.clearLamp === "BRAVE" && justice + attack + miss >= 150) {
				return "Cannot have a BRAVE clear with 150 or more non-jcrit judgements.";
			}

			// The condition for a HARD clear varies based on the skill used:
			// - JUDGE: 20 misses
			// - JUDGE+: 10 misses
			// - EMBLEM: 300 justices or below
			// Since we do not have information about the skill used, we simply validate that a
			// hard clear is not completely impossible, i.e. more than 20 misses and more than 300 justices.
			if (s.scoreData.clearLamp === "HARD" && justice + attack + miss >= 300 && miss >= 20) {
				return "Cannot have a HARD clear with 300 or more non-jcrit judgements, and over 20 misses.";
			}
		},
	],
};
