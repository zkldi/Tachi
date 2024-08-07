import { IIDXDans } from "./iidx";
import { FmtNum, FmtPercent, FmtScoreNoCommas } from "../../utils/util";
import { ClassValue, zodNonNegativeInt } from "../config-utils";
import { p } from "prudence";
import { z } from "zod";
import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_PT_CONFIG } from "../../types/internals";

export const DDR_FLARE_CATEGORIES = z.enum(["CLASSIC", "WHITE", "GOLD", "NONE"]);

export const DDR_DIFFICULTIES = ["BEGINNER", "BASIC", "DIFFICULT", "EXPERT", "CHALLENGE"];

export const DDRFlare = [
	ClassValue("NONE", "NONE"),
	ClassValue("NONE+", "NONE+"),
	ClassValue("NONE++", "NONE++"),
	ClassValue("NONE+++", "NONE+++"),
	ClassValue("MERCURY", "水星 / MERCURY"),
	ClassValue("MERCURY+", "水星 / MERCURY+"),
	ClassValue("MERCURY++", "水星 / MERCURY++"),
	ClassValue("MERCURY+++", "水星 / MERCURY+++"),
	ClassValue("VENUS", "金星 / VENUS"),
	ClassValue("VENUS+", "金星 / VENUS+"),
	ClassValue("VENUS++", "金星 / VENUS++"),
	ClassValue("VENUS+++", "金星 / VENUS+++"),
	ClassValue("EARTH", "地球 / EARTH"),
	ClassValue("EARTH+", "地球 / EARTH+"),
	ClassValue("EARTH++", "地球 / EARTH++"),
	ClassValue("EARTH+++", "地球 / EARTH+++"),
	ClassValue("MARS", "火星 / MARS"),
	ClassValue("MARS+", "火星 / MARS+"),
	ClassValue("MARS++", "火星 / MARS++"),
	ClassValue("MARS+++", "火星 / MARS+++"),
	ClassValue("JUPITER", "木星 / JUPITER"),
	ClassValue("JUPITER+", "木星 / JUPITER+"),
	ClassValue("JUPITER++", "木星 / JUPITER++"),
	ClassValue("JUPITER+++", "木星 / JUPITER+++"),
	ClassValue("SATURN", "土星 / SATURN"),
	ClassValue("SATURN+", "土星 / SATURN+"),
	ClassValue("SATURN++", "土星 / SATURN++"),
	ClassValue("SATURN+++", "土星 / SATURN+++"),
	ClassValue("URANUS", "天王星 / URANUS"),
	ClassValue("URANUS+", "天王星 / URANUS+"),
	ClassValue("URANUS++", "天王星 / URANUS++"),
	ClassValue("URANUS+++", "天王星 / URANUS+++"),
	ClassValue("NEPTUNE", "海王星 / NEPTUNE"),
	ClassValue("NEPTUNE+", "海王星 / NEPTUNE+"),
	ClassValue("NEPTUNE++", "海王星 / NEPTUNE++"),
	ClassValue("NEPTUNE+++", "海王星 / NEPTUNE+++"),
	ClassValue("SUN", "太陽 / SUN"),
	ClassValue("SUN+", "太陽 / SUN+"),
	ClassValue("SUN++", "太陽 / SUN++"),
	ClassValue("SUN+++", "太陽 / SUN+++"),
	ClassValue("WORLD", "世界 / WORLD"),
];

export const DDR_CONF = {
	name: "DDR",
	playtypes: ["SP", "DP"],
	songData: z.strictObject({
		inGameID: zodNonNegativeInt,
		flareCategory: DDR_FLARE_CATEGORIES,
	}),
} as const satisfies INTERNAL_GAME_CONFIG;

export const DDR_SP_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_000_000),
			formatter: FmtNum,
			description: "The score value. This is between 0 and 1 million.",
		},

		lamp: {
			type: "ENUM",
			values: [
				"FAILED",
				"ASSIST",
				"CLEAR",
				"FULL COMBO",
				"GREAT FULL COMBO",
				"PERFECT FULL COMBO",
				"MARVELOUS FULL COMBO",
				"LIFE4",
			],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this user got.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: [
				"E",
				"D",
				"D+",
				"C-",
				"C",
				"C+",
				"B-",
				"B",
				"B+",
				"A-",
				"A",
				"A+",
				"AA-",
				"AA",
				"AA+",
				"AAA",
			],
			minimumRelevantValue: "D",
			description:
				"The grade this score was. Note that grades are capped at F if this was a fail.",
		},
	},

	optionalMetrics: {
		flare: {
			type: "ENUM",
			values: ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "EX"],
			minimumRelevantValue: "0",
			description: "The Flare rank. If no Flare is provided, Flare 0 is chosen by default.",
		},
	},

	defaultMetric: "score",
	preferredDefaultEnum: "lamp",

	scoreRatingAlgs: {
		flareSkill: {
			description: "Flare Skill as it's implemented in DDR World.",
			formatter: FmtScoreNoCommas,
		},
	},

	sessionRatingAlgs: {
		flareSkill: {
			description: "Average of your 10 best Flare Points this session",
			formatter: FmtScoreNoCommas,
		},
	},

	profileRatingAlgs: {
		flareSkill: {
			description:
				"Flare Skill as it's implemented in DDR World, taking 30 best flare points from 3 different categories: CLASSIC (DDR 1st～X3 vs 2ndMIX), WHITE (DDR(2013)～DDR A), GOLD (DDR A20～WORLD).",
			formatter: FmtScoreNoCommas,
		},
	},

	defaultScoreRatingAlg: "flareSkill",
	defaultProfileRatingAlg: "flareSkill",
	defaultSessionRatingAlg: "flareSkill",

	difficulties: {
		type: "FIXED",
		order: DDR_DIFFICULTIES,
		shorthand: {
			BEGINNER: "BEG",
			BASIC: "BAS",
			DIFFICULT: "DIF",
			EXPERT: "EXP",
			CHALLENGE: "CHA",
		},
		default: "EXPERT",
	},

	classes: {
		flare: {
			type: "DERIVED",
			values: DDRFlare,
		},
	},

	orderedJudgements: ["MARVELOUS", "PERFECT", "GREAT", "GOOD", "MISS", "OK"],

	versions: {
		a3: "A3",
		konaste: "Konaste",
	},

	chartData: z.strictObject({
		inGameID: zodNonNegativeInt,
	}),

	preferences: z.strictObject({}),
	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["inGameID", "songTitle", "tachiSongID"],
} as const satisfies INTERNAL_GAME_PT_CONFIG;

export const DDR_DP_CONF = {
	...DDR_SP_CONF,
} as const satisfies INTERNAL_GAME_PT_CONFIG;
