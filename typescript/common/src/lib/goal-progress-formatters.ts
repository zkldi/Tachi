/**
 * Per-game formatters for displaying a user's current progress toward a goal.
 *
 * For ENUM metrics (lamp, grade), the formatter returns the current enum value
 * string. For DECIMAL/INTEGER metrics it returns a formatted number. Grade
 * metrics use grade-delta formatting (e.g. "AAA-1234").
 *
 * These live here rather than inside the `as const` game-config objects because
 * the formatter functions close over `PBScoreDocument<TGame>` types that are
 * themselves derived from the game configs — putting them inline would create a
 * circular type-inference cycle.
 */

import type { V3Game } from "../types";
import type { PBScoreDocument } from "../types/documents";

import { FmtStars } from "../config/game-support/ongeki";
import {
	ARCAEA_GBOUNDARIES,
	CHUNITHM_GBOUNDARIES,
	DDR_GBOUNDARIES,
	GITADORA_GBOUNDARIES,
	IIDXLIKE_GBOUNDARIES,
	ITG_GBOUNDARIES,
	JUBEAT_GBOUNDARIES,
	MAIMAI_GBOUNDARIES,
	MAIMAIDX_GBOUNDARIES,
	MUSECA_GBOUNDARIES,
	ONGEKI_GBOUNDARIES,
	POPN_GBOUNDARIES,
	SDVXLIKE_GBOUNDARIES,
	WACCA_GBOUNDARIES,
} from "../constants/grade-boundaries";
import { FmtNum } from "../utils/util";
import { GradeGoalFormatter } from "./goal-title";

export type GoalProgressFormatter<TGame extends V3Game = V3Game> = (
	pb: PBScoreDocument<TGame>,
	goalValue: number,
) => string;

export type GPTGoalProgressFormatters<TGame extends V3Game> = Record<
	string,
	GoalProgressFormatter<TGame>
>;

const IIDXLIKE_GOAL_PG_FMT: GPTGoalProgressFormatters<
	"bms-7k" | "bms-14k" | "iidx-dp" | "iidx-sp" | "pms-controller" | "pms-keyboard"
> = {
	percent: (pb) => `${pb.scoreData.percent.toFixed(2)}%`,

	// 4519 -> "4519". Don't add commas or anything.
	score: (pb) => pb.scoreData.score.toString(),

	lamp: (pb) => {
		if (typeof pb.scoreData.optional.bp === "number") {
			return `${pb.scoreData.lamp} (BP: ${pb.scoreData.optional.bp})`;
		}

		return pb.scoreData.lamp;
	},
	grade: (pb, gradeIndex) =>
		GradeGoalFormatter(
			IIDXLIKE_GBOUNDARIES,
			pb.scoreData.grade,
			pb.scoreData.percent,
			IIDXLIKE_GBOUNDARIES[gradeIndex]!.name,

			// use notecount to turn the percent deltas into whole ex-scores.
			(deltaPercent) => {
				const max = Math.floor(pb.scoreData.score / (pb.scoreData.percent / 100));

				return Math.round((deltaPercent / 100) * max).toFixed(0);
			},
		),
};

const SDVXLIKE_GOAL_PG_FMT: GPTGoalProgressFormatters<"sdvx" | "usc-controller" | "usc-keyboard"> =
	{
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				SDVXLIKE_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				SDVXLIKE_GBOUNDARIES[gradeIndex]!.name,
			),
	};

const GITADORA_GOAL_PG_FMT: GPTGoalProgressFormatters<"gitadora-dora" | "gitadora-gita"> = {
	lamp: (pb) => pb.scoreData.lamp,
	percent: (pb) => `${pb.scoreData.percent.toFixed(2)}%`,
	grade: (pb, gradeIndex) =>
		GradeGoalFormatter(
			GITADORA_GBOUNDARIES,
			pb.scoreData.grade,
			pb.scoreData.percent,
			GITADORA_GBOUNDARIES[gradeIndex]!.name,
			(v) => `${v.toFixed(2)}%`,
		),
};

export const GAME_GOAL_PROGRESS_FORMATTERS: {
	[TGame in V3Game]: GPTGoalProgressFormatters<TGame>;
} = {
	"iidx-sp": IIDXLIKE_GOAL_PG_FMT,
	"iidx-dp": IIDXLIKE_GOAL_PG_FMT,
	"bms-7k": IIDXLIKE_GOAL_PG_FMT,
	"bms-14k": IIDXLIKE_GOAL_PG_FMT,
	"pms-controller": IIDXLIKE_GOAL_PG_FMT,
	"pms-keyboard": IIDXLIKE_GOAL_PG_FMT,
	sdvx: SDVXLIKE_GOAL_PG_FMT,
	"usc-controller": SDVXLIKE_GOAL_PG_FMT,
	"usc-keyboard": SDVXLIKE_GOAL_PG_FMT,
	"gitadora-dora": GITADORA_GOAL_PG_FMT,
	"gitadora-gita": GITADORA_GOAL_PG_FMT,

	arcaea: {
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				ARCAEA_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				ARCAEA_GBOUNDARIES[gradeIndex]!.name,
			),
	},

	chunithm: {
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

	"ddr-sp": {
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				DDR_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				DDR_GBOUNDARIES[gradeIndex]!.name,
				(delta) => FmtNum(delta),
			),
	},

	"ddr-dp": {
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				DDR_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				DDR_GBOUNDARIES[gradeIndex]!.name,
				(delta) => FmtNum(delta),
			),
	},

	"itg-stamina": {
		lamp: (pb) => {
			if (pb.scoreData.lamp === "FAILED") {
				return `Died ${pb.scoreData.survivedPercent.toFixed(2)}% in`;
			}

			return pb.scoreData.lamp;
		},
		scorePercent: (pb) => `${pb.scoreData.scorePercent.toFixed(2)}%`,
		survivedPercent: (pb) => `${pb.scoreData.survivedPercent.toFixed(2)}%`,
		finalPercent: (pb) => {
			if (pb.scoreData.finalPercent < 100) {
				return `Died ${pb.scoreData.survivedPercent.toFixed(2)}% in`;
			}

			return `${pb.scoreData.lamp} with ${pb.scoreData.scorePercent.toFixed(2)}%`;
		},
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				ITG_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.scorePercent,
				ITG_GBOUNDARIES[gradeIndex]!.name,
				(v) => `${v.toFixed(2)}%`,
			),
	},

	jubeat: {
		score: (pb) => FmtNum(pb.scoreData.score),
		musicRate: (pb) => `${pb.scoreData.musicRate.toFixed(1)}%`,
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				JUBEAT_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				JUBEAT_GBOUNDARIES[gradeIndex]!.name,
			),
	},

	maimai: {
		percent: (pb) => `${pb.scoreData.percent.toFixed(2)}%`,
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) => {
			if (pb.scoreData.grade === "SSS+") {
				return "SSS+";
			}

			const goalGrade = MAIMAI_GBOUNDARIES[gradeIndex]!.name;

			// Grade SSS+ is chart-dependent; we can't get exact percent delta.
			if (goalGrade === "SSS+" && pb.scoreData.grade === "SSS") {
				const boundary =
					MAIMAI_GBOUNDARIES.find((c) => c.name === "SSS")?.lowerBound ?? 100;
				const delta = pb.scoreData.percent - boundary;

				return `SSS+${delta.toFixed(2)}%`;
			}

			return GradeGoalFormatter(
				MAIMAI_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.percent,
				goalGrade,
				(v) => `${v.toFixed(2)}%`,
			);
		},
	},

	maimaidx: {
		percent: (pb) => `${pb.scoreData.percent.toFixed(4)}%`,
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				MAIMAIDX_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.percent,
				MAIMAIDX_GBOUNDARIES[gradeIndex]!.name,
				(v) => `${v.toFixed(4)}%`,
			),
	},

	museca: {
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				MUSECA_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				MUSECA_GBOUNDARIES[gradeIndex]!.name,
			),
	},

	ongeki: {
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				ONGEKI_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				ONGEKI_GBOUNDARIES[gradeIndex]?.name ?? "D",
			),
		noteLamp: (pb) => pb.scoreData.noteLamp,
		bellLamp: (pb) => pb.scoreData.bellLamp,
		score: (pb) => FmtNum(pb.scoreData.score),
		platinumScore: (pb) => FmtNum(pb.scoreData.platinumScore),
		platinumStars: (pb) => FmtStars(pb.scoreData.platinumStars, false),
	},

	popn: {
		score: (pb) => FmtNum(pb.scoreData.score),
		clearMedal: (pb) => pb.scoreData.clearMedal,
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				POPN_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				POPN_GBOUNDARIES[gradeIndex]!.name,
			),
	},

	wacca: {
		score: (pb) => FmtNum(pb.scoreData.score),
		lamp: (pb) => pb.scoreData.lamp,
		grade: (pb, gradeIndex) =>
			GradeGoalFormatter(
				WACCA_GBOUNDARIES,
				pb.scoreData.grade,
				pb.scoreData.score,
				WACCA_GBOUNDARIES[gradeIndex]!.name,
			),
	},
};
