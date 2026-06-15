import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum } from "../../utils/util";
import { ClassValue, ToDecimalPlaces, zodNonNegativeInt } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_CHUNITHM_CONF = {
	name: "CHUNITHM",
	dynamicContent: false,
	games: ["chunithm"],
	playtypes: ["Single"],
	songData: z.strictObject({
		genre: z.string(),
		duration: z.number().optional(),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

export const CHUNITHMColours = [
	ClassValue("BLUE", "青", "Blue: 0 - 1.99 Rating"),
	ClassValue("GREEN", "緑", "Green: 2 - 3.99 Rating"),
	ClassValue("ORANGE", "橙", "Orange: 4 - 6.99 Rating"),
	ClassValue("RED", "赤", "Red: 7 - 9.99 Rating"),
	ClassValue("PURPLE", "紫", "Purple: 10 - 11.99 Rating"),
	ClassValue("COPPER", "銅", "Copper: 12 - 13.24 Rating"),
	ClassValue("SILVER", "銀", "Silver: 13.25 - 14.49 Rating"),
	ClassValue("GOLD", "金", "Gold: 14.50 - 15.24 Rating"),
	ClassValue("PLATINUM", "鉑★", "Platinum I: 15.25 - 15.49 Rating"),
	ClassValue("PLATINUM_II", "鉑★★", "Platinum II: 15.50 - 15.74 Rating"),
	ClassValue("PLATINUM_III", "鉑★★★", "Platinum III: 15.75 - 15.99 Rating"),
	ClassValue("RAINBOW", "虹★", "Rainbow I: >=16 Rating"),
	ClassValue("RAINBOW_II", "虹★★", "Rainbow II: >=16.25 Rating"),
	ClassValue("RAINBOW_III", "虹★★★", "Rainbow III: >=16.5 Rating"),
	ClassValue("RAINBOW_IV", "虹★★★★", "Rainbow IV: >=16.75 Rating"),
	ClassValue("RAINBOW_EX_I", "虹(極)★", "Rainbow Extreme I: >=17 Rating"),
	ClassValue("RAINBOW_EX_II", "虹(極)★★", "Rainbow Extreme II: >=17.25 Rating"),
	ClassValue("RAINBOW_EX_III", "虹(極)★★★", "Rainbow Extreme III: >=17.5 Rating"),
];

export const CHUNITHMClasses = [
	ClassValue("DAN_I", "I", "Class I"),
	ClassValue("DAN_II", "II", "Class II"),
	ClassValue("DAN_III", "III", "Class III"),
	ClassValue("DAN_IV", "IV", "Class IV"),
	ClassValue("DAN_V", "V", "Class V"),
	ClassValue("DAN_INFINITE", "∞", "Infinite Class"),
];

export const GAME_CHUNITHM_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_010_000),
			formatter: FmtNum,
			goalTitleFormatter: (v) => `Get a score of ${v.toLocaleString("en-GB")} on`,
			goalOutOfFormatter: (v) => v.toLocaleString("en-GB"),
			description: "The score value. This is between 0 and 1.01 million.",
		},
		noteLamp: {
			type: "ENUM",
			values: ["NONE", "FULL COMBO", "ALL JUSTICE", "ALL JUSTICE CRITICAL"],
			minimumRelevantValue: "FULL COMBO",
			description: "The type of combo this was.",
		},
		clearLamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "HARD", "BRAVE", "ABSOLUTE", "CATASTROPHY"],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: [
				"D",
				"C",
				"B",
				"BB",
				"BBB",
				"A",
				"AA",
				"AAA",
				"S",
				"S+",
				"SS",
				"SS+",
				"SSS",
				"SSS+",
			],
			minimumRelevantValue: "A",
			description: "The grade this score was.",
		},
	},

	defaultMetric: "score",
	preferredDefaultEnum: "grade",

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,
		scoreGraph: {
			type: "GRAPH",
			validate: p.isBetween(0, 1010000),
			description: "The history of the projected score, queried in one-second intervals.",
		},
		lifeGraph: {
			type: "GRAPH",
			validate: p.isBetween(0, 999),
			description: "Challenge gauge history, queried in one-second intervals.",
		},
	},

	scoreRatingAlgs: {
		rating: {
			description:
				"The rating value of this score. This is identical to the system used in game.",
			formatter: ToDecimalPlaces(2),
		},
	},
	sessionRatingAlgs: {
		naiveRating: {
			description: "The average of your best 10 ratings this session.",
			formatter: ToDecimalPlaces(2),
		},
	},
	profileRatingAlgs: {
		naiveRating: {
			description: "The average of your best 50 ratings.",
			formatter: ToDecimalPlaces(2),
			associatedScoreAlgs: ["rating"],
		},
	},

	defaultScoreRatingAlg: "rating",
	defaultSessionRatingAlg: "naiveRating",
	defaultProfileRatingAlg: "naiveRating",

	difficulties: {
		type: "CHUGEKIMAI_STYLE",
		order: ["BASIC", "ADVANCED", "EXPERT", "MASTER", "ULTIMA"],
		formatShort: {
			BASIC: "B",
			ADVANCED: "A",
			EXPERT: "E",
			MASTER: "M",
			ULTIMA: "U",
		},
		formatLong: {},
		default: "MASTER",
	},

	classes: {
		colour: {
			type: "DERIVED",
			values: CHUNITHMColours,
			minimumScores: 50,
			minimumRelevantValue: "RAINBOW",
		},

		dan: {
			type: "PROVIDED",
			values: CHUNITHMClasses,
		},

		emblem: {
			type: "PROVIDED",
			values: CHUNITHMClasses,
		},
	},

	orderedJudgements: ["jcrit", "justice", "attack", "miss"],

	versions: {
		paradiselost: "PARADISE LOST",
		new: "NEW",
		newplus: "NEW PLUS",
		sun: "SUN",
		"sun-intl": "SUN International",
		"sun-omni": "SUN Omnimix",
		sunplus: "SUN PLUS",
		"sunplus-intl": "SUN PLUS International",
		"sunplus-omni": "SUN PLUS Omnimix",
		luminous: "LUMINOUS",
		"luminous-intl": "LUMINOUS International",
		"luminous-omni": "LUMINOUS Omnimix",
		luminousplus: "LUMINOUS PLUS",
		"luminousplus-intl": "LUMINOUS PLUS International",
		"luminousplus-omni": "LUMINOUS PLUS Omnimix",
		verse: "VERSE",
		"verse-intl": "VERSE International",
		"verse-omni": "VERSE Omnimix",
		xverse: "X-VERSE",
		"xverse-intl": "X-VERSE International",
		"xverse-omni": "X-VERSE Omnimix",
		xversex: "X-VERSE-X",
		"xversex-intl": "X-VERSE-X International",
		"xversex-omni": "X-VERSE-X Omnimix",
	},

	chartData: z.strictObject({
		inGameID: z.union([z.array(zodNonNegativeInt), zodNonNegativeInt]),
		displayVersion: z.string(),
	}),

	preferences: z.strictObject({}),

	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["gcmInGameIDSpecialChart", "inGameID", "songTitle", "tachiSongID"],
} as const satisfies INTERNAL_GAME_CONFIG;
