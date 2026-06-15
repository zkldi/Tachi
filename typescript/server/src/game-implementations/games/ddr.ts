import type {
	GameImplementation,
	GPTProfileCalcs,
	ScoreValidator,
} from "#game-implementations/types";

import DB from "#services/pg/db";
import { IsNullish } from "#utils/misc";
import { sql } from "kysely";
import { DDRFlare } from "rg-stats";
import {
	type ChartDocument,
	DDR_GBOUNDARIES,
	GetGameConfig,
	GetGrade,
	type ScoreDocument,
} from "tachi-common";

import { CreatePBMergeFor } from "../utils/pb-merge";
import { SessionAvgBest10For } from "../utils/session-calc";
/** `ddr:SP` / `ddr:DP` as v3 games. */
type DDRGames = "ddr-dp" | "ddr-sp";

export const DDR_SCORE_VALIDATORS: Array<ScoreValidator<DDRGames>> = [
	(s: ScoreDocument<DDRGames>, chart?: ChartDocument<DDRGames>) => {
		if (s.scoreData.lamp === "FAILED" || !chart || IsNullish(chart.data.stepCount)) {
			return;
		}

		const { MARVELOUS, PERFECT, GREAT, GOOD, OK, MISS } = s.scoreData.judgements;

		if (
			IsNullish(MARVELOUS) ||
			IsNullish(PERFECT) ||
			IsNullish(GREAT) ||
			IsNullish(GOOD) ||
			IsNullish(OK) ||
			IsNullish(MISS)
		) {
			return;
		}

		const maxPoints = 5 * chart.data.stepCount;
		const scorePoints = 5 * (MARVELOUS + PERFECT + OK) + 3 * GREAT + GOOD;

		const penaltiedPoints = scorePoints * 100_000 - (PERFECT + GREAT + GOOD) * maxPoints;
		const calculatedScore = Math.floor(penaltiedPoints / maxPoints) * 10;

		if (calculatedScore !== s.scoreData.score) {
			return `Expected calculated score from judgements of ${calculatedScore} to equal score of ${s.scoreData.score}.`;
		}
	},
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
	(s) => {
		const { MARVELOUS, PERFECT, GREAT, OK } = s.scoreData.judgements;

		if (
			IsNullish(MARVELOUS) ||
			IsNullish(PERFECT) ||
			IsNullish(GREAT) ||
			IsNullish(OK) ||
			IsNullish(s.scoreData.optional.exScore)
		) {
			return;
		}

		const calculatedExScore = MARVELOUS * 3 + OK * 3 + PERFECT * 2 + GREAT;

		if (calculatedExScore !== s.scoreData.optional.exScore) {
			return `EXScore expected to be ${calculatedExScore} instead of ${s.scoreData.optional.exScore}`;
		}
	},
];

const DDR_PROFILE_CALCS: GPTProfileCalcs<DDRGames> = async (game, userID) => {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select([
			sql<number>`(pb.calculated_data::jsonb->>'flareSkill')::double precision`.as(
				"flare_skill",
			),
			sql<string | null>`song.data::jsonb->>'flareCategory'`.as("flare_category"),
		])
		.where("pb.user_id", "=", userID)
		.where("chart.game", "=", game)
		.where("chart.is_primary", "=", true)
		.where((eb) =>
			eb(sql`jsonb_typeof(pb.calculated_data::jsonb -> 'flareSkill')`, "=", sql`'number'`),
		)
		.orderBy(sql`(pb.calculated_data::jsonb->>'flareSkill')::double precision`, "desc")
		.execute();

	if (rows.length === 0) {
		return { flareSkill: null };
	}

	let classicIndex = 0;
	let goldIndex = 0;
	let whiteIndex = 0;

	const scored = rows.map((row) => {
		let top: number;

		if (row.flare_category === "CLASSIC") {
			top = classicIndex++;
		} else if (row.flare_category === "WHITE") {
			top = whiteIndex++;
		} else if (row.flare_category === "GOLD") {
			top = goldIndex++;
		} else {
			top = 99; // Score will be filtered out
		}

		return { flareSkill: row.flare_skill, top };
	});

	const flareSkill = scored.filter((e) => e.top < 30).reduce((a, e) => a + e.flareSkill, 0);

	return { flareSkill };
};

function DeriveFlareClass(flarePoints: number) {
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
		default:
			return "WORLD";
	}
}

export const DDR_IMPL: GameImplementation<DDRGames> = {
	chartSpecificValidators: {},
	classDerivers: (ratings) => {
		const flarePoints = ratings.flareSkill;

		return { flare: IsNullish(flarePoints) ? null : DeriveFlareClass(flarePoints) };
	},
	defaultMergeRefName: "Best Score",
	scoreDeriver: (scoreData, _chart) => ({
		grade: scoreData.lamp === "FAILED" ? "E" : GetGrade(DDR_GBOUNDARIES, scoreData.score),
	}),
	scoreCalcs: (scoreData, _derivedData, chart) => {
		if (scoreData.lamp === "FAILED") {
			return { flareSkill: 0 };
		}

		const flareConf = GetGameConfig(chart.game).optionalMetrics.flare;
		const flareLevel =
			scoreData.optional.flare && flareConf.type === "ENUM"
				? flareConf.values.indexOf(scoreData.optional.flare)
				: 0;

		return { flareSkill: DDRFlare.calculate(chart.levelNum, flareLevel) };
	},
	pbRankingValues: (pb) => ({
		ranking: pb.scoreData.score,
		tb1: pb.scoreData.enumIndexes.lamp,
		tb2: null,
		tb3: null,
		tb4: null,
		tb5: null,
	}),
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
			{ type: "REGULAR", metric: "score" },
			"Best Score",
			(base, score) => {
				base.scoreData.score = score.scoreData.score;
				base.scoreData.grade = score.scoreData.grade;
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
		CreatePBMergeFor(
			"largest",
			{
				type: "REGULAR",
				metric: "flare",
			},
			"Best Flare",
			(base, score) => {
				base.scoreData.optional.flare =
					score.scoreData.lamp !== "FAILED"
						? score.scoreData.optional.flare
						: base.scoreData.optional.flare;
				base.calculatedData.flareSkill =
					score.scoreData.lamp !== "FAILED"
						? score.calculatedData.flareSkill
						: base.calculatedData.flareSkill;
			},
		),
	],
	sessionCalcs: (arr) => ({
		flareSkill: SessionAvgBest10For("flareSkill")(arr),
	}),
	profileCalcs: DDR_PROFILE_CALCS,
	scoreValidators: DDR_SCORE_VALIDATORS,
	chartDataRelevantFields: ["levelNum"],
};
