import {
	GoalFmtPercent,
	GoalFmtScore,
	GoalOutOfFmtPercent,
	GoalOutOfFmtScore,
	GradeGoalFormatter,
} from "./_common";
import db from "../../external/mongo/db";
import { IsNullish } from "../../utils/misc";
import { CreatePBMergeFor } from "../utils/pb-merge";
import { SessionAvgBest10For } from "../utils/session-calc";
import { DDRFlare } from "rg-stats";
import {
	DDR_GBOUNDARIES,
	FmtNum,
	type Game,
	GetGrade,
	GetSpecificGPTConfig,
	type integer,
	type Playtype,
} from "tachi-common";
import type {
	GPTGoalFormatters,
	GPTGoalProgressFormatters,
	GPTServerImplementation,
	ScoreValidator,
} from "game-implementations/types";
import type { PBScoreDocument, SongDocument } from "tachi-common";

interface PBScoreDocumentWithSong extends PBScoreDocument<"ddr:DP" | "ddr:SP"> {
	song: SongDocument<"ddr">;
	top?: number;
}

const FLARE_0_POINTS = [
	145, 155, 170, 185, 205, 230, 255, 290, 335, 400, 465, 510, 545, 575, 600, 620, 635, 650, 665,
];

const DDR_GOAL_FMT: GPTGoalFormatters<"ddr:DP" | "ddr:SP"> = {
	score: GoalFmtScore,
};

const DDR_GOAL_OO_FMT: GPTGoalFormatters<"ddr:DP" | "ddr:SP"> = {
	score: GoalOutOfFmtScore,
};

const DDR_GOAL_PG_FMT: GPTGoalProgressFormatters<"ddr:DP" | "ddr:SP"> = {
	score: (pb) => FmtNum(pb.scoreData.score),
	lamp: (pb) => {
		return pb.scoreData.lamp;
	},
	grade: (pb, gradeIndex) =>
		GradeGoalFormatter(
			DDR_GBOUNDARIES,
			pb.scoreData.grade,
			pb.scoreData.score,
			DDR_GBOUNDARIES[gradeIndex]!.name,
			(delta) => {
				return FmtNum(delta);
			}
		),
};

export const DDR_SCORE_VALIDATORS: Array<ScoreValidator<"ddr:DP" | "ddr:SP">> = [
	// Score validation with judgements is disabled until we have stepCount + holdCount for every chart.
	// Using the sum of all judgements does not work in case of missed holds.
	// (s) => {
	// if (s.scoreData.lamp === "FAILED") {
	// return;
	// }
	//
	// const { MARVELOUS, PERFECT, GREAT, GOOD, OK, MISS } = s.scoreData.judgements;
	//
	// if (
	// IsNullish(MARVELOUS) ||
	// IsNullish(PERFECT) ||
	// IsNullish(GREAT) ||
	// IsNullish(GOOD) ||
	// IsNullish(OK) ||
	// IsNullish(MISS)
	// ) {
	// return;
	// }
	//
	// const stepScore = 1_000_000 / (MARVELOUS + PERFECT + GREAT + GOOD + OK + MISS);
	// const calculatedScore =
	// Math.floor(
	// (stepScore * (MARVELOUS + OK) +
	// 				(stepScore - 10) * PERFECT +
	// 				((stepScore * 3) / 5 - 10) * GREAT +
	// 				(stepScore / 5 - 10) * GOOD) /
	// 				10
	// ) * 10;
	//
	// if (calculatedScore !== s.scoreData.score) {
	// return `Expected calculated score from judgements of ${calculatedScore} to equal score of ${s.scoreData.score}.`;
	// }
	// },
	(s) => {
		const { MARVELOUS, PERFECT, GREAT, GOOD, MISS } = s.scoreData.judgements;

		if (
			IsNullish(MARVELOUS) ||
			IsNullish(PERFECT) ||
			IsNullish(GREAT) ||
			IsNullish(GOOD) ||
			IsNullish(MISS)
		) {
			return;
		}

		switch (s.scoreData.lamp) {
			case "FULL COMBO": {
				if (MISS > 0) {
					return `Cannot have a FULL COMBO with more than 0 MISS`;
				}

				break;
			}

			case "GREAT FULL COMBO": {
				if (MISS > 0 || GOOD > 0) {
					return `Cannot have a GREAT FULL COMBO with more than 0 MISS and GOOD`;
				}

				break;
			}

			case "PERFECT FULL COMBO": {
				if (MISS > 0 || GOOD > 0 || GREAT > 0) {
					return `Cannot have a PERFECT FULL COMBO with more than 0 MISS, GOOD and GREAT`;
				}

				break;
			}

			case "MARVELOUS FULL COMBO": {
				if (MISS > 0 || GOOD > 0 || GREAT > 0 || PERFECT > 0) {
					return `Cannot have a MARVELOUS FULL COMBO with anyhing else than MARVELOUS judgements`;
				}

				break;
			}

			default:
		}
	},
];

export const DDR_IMPL: GPTServerImplementation<"ddr:DP" | "ddr:SP"> = {
	chartSpecificValidators: {},
	classDerivers: {
		flare: (ratings) => {
			const flarePoints = ratings.flareSkill;

			if (IsNullish(flarePoints)) {
				return null;
			}

			switch (true) {
				case flarePoints < 500:
					return "NONE";
				case flarePoints < 1000:
					return "NONE+";
				case flarePoints < 1500:
					return "NONE++";
				case flarePoints < 2000:
					return "NONE+++";
				case flarePoints < 3000:
					return "MERCURY";
				case flarePoints < 4000:
					return "MERCURY+";
				case flarePoints < 5000:
					return "MERCURY++";
				case flarePoints < 6000:
					return "MERCURY+++";
				case flarePoints < 7000:
					return "VENUS";
				case flarePoints < 8000:
					return "VENUS+";
				case flarePoints < 9000:
					return "VENUS++";
				case flarePoints < 10000:
					return "VENUS+++";
				case flarePoints < 11500:
					return "EARTH";
				case flarePoints < 13000:
					return "EARTH+";
				case flarePoints < 14500:
					return "EARTH++";
				case flarePoints < 16000:
					return "EARTH+++";
				case flarePoints < 18000:
					return "MARS";
				case flarePoints < 20000:
					return "MARS+";
				case flarePoints < 22000:
					return "MARS++";
				case flarePoints < 24000:
					return "MARS+++";
				case flarePoints < 26500:
					return "JUPITER";
				case flarePoints < 29000:
					return "JUPITER+";
				case flarePoints < 31500:
					return "JUPITER++";
				case flarePoints < 34000:
					return "JUPITER+++";
				case flarePoints < 36750:
					return "SATURN";
				case flarePoints < 39500:
					return "SATURN+";
				case flarePoints < 42250:
					return "SATURN++";
				case flarePoints < 45000:
					return "SATURN+++";
				case flarePoints < 48750:
					return "URANUS";
				case flarePoints < 52500:
					return "URANUS+";
				case flarePoints < 56250:
					return "URANUS++";
				case flarePoints < 60000:
					return "URANUS+++";
				case flarePoints < 63750:
					return "NEPTUNE";
				case flarePoints < 67500:
					return "NEPTUNE+";
				case flarePoints < 71250:
					return "NEPTUNE++";
				case flarePoints < 75000:
					return "NEPTUNE+++";
				case flarePoints < 78750:
					return "SUN";
				case flarePoints < 82500:
					return "SUN+";
				case flarePoints < 86250:
					return "SUN++";
				case flarePoints < 90000:
					return "SUN+++";
			}

			return "WORLD";
		},
	},
	defaultMergeRefName: "Best Score",
	derivers: {
		grade: ({ score, lamp }) => {
			if (lamp === "FAILED") {
				return "E";
			}

			return GetGrade(DDR_GBOUNDARIES, score);
		},
	},
	goalCriteriaFormatters: DDR_GOAL_FMT,
	goalProgressFormatters: DDR_GOAL_PG_FMT,
	goalOutOfFormatters: DDR_GOAL_OO_FMT,
	pbMergeFunctions: [
		CreatePBMergeFor("largest", "enumIndexes.lamp", "Best Lamp", (base, score) => {
			base.scoreData.lamp = score.scoreData.lamp;
		}),
		CreatePBMergeFor("largest", "score", "Best Score", (base, score) => {
			base.scoreData.score = score.scoreData.score;
			base.scoreData.grade = score.scoreData.grade;
		}),
	],
	profileCalcs: {
		flareSkill: async (game: Game, playtype: Playtype, userID: integer) => {
			const sc: Array<PBScoreDocumentWithSong> = await db["personal-bests"].aggregate([
				{
					$match: {
						userID,
						game,
						playtype,
						isPrimary: true,
						[`calculatedData.flareSkill`]: { $type: "number" },
					},
				},
				{
					$lookup: {
						from: "songs-ddr",
						localField: "songID",
						foreignField: "id",
						as: "song",
					},
				},
				{
					$unwind: {
						path: "$song",
					},
				},
				{
					$sort: {
						[`calculatedData.flareSkill`]: -1,
					},
				},
			]);

			if (sc.length === 0) {
				return null;
			}

			let classicIndex = 0;
			let goldIndex = 0;
			let whiteIndex = 0;

			for (const score of sc) {
				if (score.song.data.flareCategory === "CLASSIC") {
					score.top = classicIndex++;
				} else if (score.song.data.flareCategory === "WHITE") {
					score.top = whiteIndex++;
				} else if (score.song.data.flareCategory === "GOLD") {
					score.top = goldIndex++;
				} else {
					score.top = 99; // Score will be filtered out
				}
			}

			return sc
				.filter((score: PBScoreDocumentWithSong) => score.top! < 30)
				.reduce(
					(a: number, e: PBScoreDocumentWithSong) => a + e.calculatedData.flareSkill!,
					0
				);
		},
	},
	scoreCalcs: {
		flareSkill: (scoreData, chart) => {
			// No flare if the song is failed
			if (scoreData.lamp === "FAILED") {
				return 0;
			}

			const flareLevel = scoreData.optional.flare
				? GetSpecificGPTConfig("ddr:SP").optionalMetrics.flare.values.indexOf(
						scoreData.optional.flare
				  )
				: 0;

			return DDRFlare.calculate(chart.levelNum, flareLevel);
		},
	},
	scoreValidators: DDR_SCORE_VALIDATORS,
	sessionCalcs: {
		flareSkill: SessionAvgBest10For("flareSkill"),
	},
};
