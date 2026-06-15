import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum } from "../../utils/util";
import { ClassValue, zodNonNegativeInt } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_WACCA_CONF = {
	name: "WACCA",
	dynamicContent: false,
	games: ["wacca"],
	playtypes: ["Single"],
	songData: z.strictObject({
		genre: z.string(),
		displayVersion: z.nullable(z.string()),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

export const WaccaStageUps = [
	ClassValue("I", "I"),
	ClassValue("II", "II"),
	ClassValue("III", "III"),
	ClassValue("IV", "IV"),
	ClassValue("V", "V"),
	ClassValue("VI", "VI"),
	ClassValue("VII", "VII"),
	ClassValue("VIII", "VIII"),
	ClassValue("IX", "IX"),
	ClassValue("X", "X"),
	ClassValue("XI", "XI"),
	ClassValue("XII", "XII"),
	ClassValue("XIII", "XIII"),
	ClassValue("XIV", "XIV"),
];

export const WaccaColours = [
	ClassValue("ASH", "Ash"),
	ClassValue("NAVY", "Navy"),
	ClassValue("YELLOW", "Yellow"),
	ClassValue("RED", "Red"),
	ClassValue("PURPLE", "Purple"),
	ClassValue("BLUE", "Blue"),
	ClassValue("SILVER", "Silver"),
	ClassValue("GOLD", "Gold"),
	ClassValue("RAINBOW", "Rainbow"),
];

export const GAME_WACCA_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_000_000),
			formatter: FmtNum,
			goalTitleFormatter: (v) => `Get a score of ${v.toLocaleString("en-GB")} on`,
			goalOutOfFormatter: (v) => v.toLocaleString("en-GB"),
			description: "The score value. This is between 0 and 1 million.",
		},
		lamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "MISSLESS", "FULL COMBO", "ALL MARVELOUS"],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this score was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: [
				"D",
				"C",
				"B",
				"A",
				"AA",
				"AAA",
				"S",
				"S+",
				"SS",
				"SS+",
				"SSS",
				"SSS+",
				"MASTER",
			],
			minimumRelevantValue: "S",
			description: "The grade this score was.",
		},
	},

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,
	},

	defaultMetric: "score",
	preferredDefaultEnum: "grade",

	scoreRatingAlgs: {
		rate: {
			description: "Rating as it's implemented in game.",
		},
	},
	profileRatingAlgs: {
		naiveRate: {
			description: "A naive rating algorithm that just sums your 50 best scores.",
			associatedScoreAlgs: ["rate"],
		},
	},
	sessionRatingAlgs: {
		rate: { description: "The average of your best 10 ratings this session." },
	},

	defaultScoreRatingAlg: "rate",
	defaultProfileRatingAlg: "naiveRate",
	defaultSessionRatingAlg: "rate",

	difficulties: {
		type: "FIXED",
		order: ["NORMAL", "HARD", "EXPERT", "INFERNO"],
		formatShort: {
			NORMAL: "NRM",
			HARD: "HRD",
			EXPERT: "EXP",
			INFERNO: "INF",
		},
		formatLong: {},
		default: "EXPERT",
	},

	classes: {
		stageUp: {
			type: "PROVIDED",
			values: WaccaStageUps,
		},
		colour: {
			type: "DERIVED",
			values: WaccaColours,
			minimumRelevantValue: "RAINBOW",
		},
	},

	orderedJudgements: ["marvelous", "great", "good", "miss"],

	versions: {
		reverse: "REVERSE",
		plus: "PLUS",
	},

	chartData: z.strictObject({
		inGameID: zodNonNegativeInt,
	}),

	preferences: z.strictObject({}),
	scoreMeta: z.strictObject({ mirror: z.boolean().optional() }),

	supportedMatchTypes: ["songTitle", "tachiSongID", "inGameID"],
} as const satisfies INTERNAL_GAME_CONFIG;
