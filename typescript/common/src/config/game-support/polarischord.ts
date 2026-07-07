import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum } from "../../utils/util";
import { ClassValue, zodNonNegativeInt } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_POLARISCHORD_CONF = {
	name: "Polaris Chord",
	dynamicContent: false,
	games: ["polarischord"],
	playtypes: ["Single"],
	songData: z.strictObject({
		genre: z.string().optional(),
		displayVersion: z.nullable(z.string()).optional(),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

//PA SKILL colours for each class are listed here
export const PolarisChordColours = [
	ClassValue("GRAY", "Gray"),
	ClassValue("GREEN", "Green"),
	ClassValue("LIME", "Lime"),
	ClassValue("BLUE", "Blue"),
	ClassValue("CYAN", "Cyan"),
	ClassValue("LEMON", "Lemon"),
	ClassValue("ORANGE", "Orange"),
	ClassValue("CORAL", "Coral"),
	ClassValue("RED", "Red"),
	ClassValue("PURPLE", "Purple"),
	ClassValue("NAVY", "Navy"),
	ClassValue("RAINBOW", "Rainbow"),
];

export const GAME_POLARISCHORD_CONF = {
	providedMetrics: {
		percent: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: (v) => `${v.toFixed(2)}%`,
			goalTitleFormatter: (v) => `Get a percent of ${v.toFixed(2)}% on`,
			goalOutOfFormatter: (v) => `${v.toFixed(2)}%`,
			description: "The ACHIEVEMENT RATE value. This is between 0 and 100%.",
		},
		lamp: {
			type: "ENUM",
			values: ["NO PLAY", "GOOD TRY", "SUCCESS", "FULL COMBO", "ALL PERFECT"],
			minimumRelevantValue: "SUCCESS",
			description: "The type of clear this score was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: ["D", "C", "B", "A", "AA", "AAA", "S", "SS", "SSS", "SSS+", "AP"],
			minimumRelevantValue: "S",
			description: "The grade this score was.",
		},
	},

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,
		//timing mettics
		fastBad: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Early Bad judgements." },
		fastGood: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Early Good judgements." },
		fastGreat: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Early Great judgements." },
		slowGreat: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Late Great judgements." },
		slowGood: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Late Good judgements." },
		slowBad: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Late Bad judgements." },
		//note type metrics
		hold: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Successful hold judgements." },
		holdMax: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Maximum possible hold judgements." },
		flick: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Successful flick judgements." },
		flickMax: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Maximum possible flick judgements." },
		fader: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Successful fader judgements." },
		faderMax: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Maximum possible fader judgements." },
		honeycomb: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Successful honeycomb judgements." },
		honeycombMax: { type: "INTEGER", validate: p.isPositiveInteger, formatter: FmtNum, description: "Maximum possible honeycomb judgements." },
	},

	defaultMetric: "percent",
	preferredDefaultEnum: "grade",

	scoreRatingAlgs: {
		paSkill: {
			description: "PA SKILL for a single chart.",
			canSetGoalsOn: true,
			formatter: (v) => v.toFixed(2),
		},
	},
	profileRatingAlgs: {
		paSkill: {
			description: "The user's PA SKILL, calculated from their best 30 scores.",
			associatedScoreAlgs: ["paSkill"],
			formatter: (v) => v.toFixed(2),
		},
	},
	sessionRatingAlgs: {
		paSkill: { 
			description: "The average of your best PA SKILL ratings this session.",
			formatter: (v) => v.toFixed(2), //should always displays 2 digit in client as opposed to 5 full digits in the server as shown in-game
		},
	},

	defaultScoreRatingAlg: "paSkill",
	defaultProfileRatingAlg: "paSkill",
	defaultSessionRatingAlg: "paSkill",

	difficulties: {
		type: "FIXED",
		order: ["EASY", "NORMAL", "HARD", "INFLUENCE", "POLAR"],
		formatShort: {
			EASY: "ESY",
			NORMAL: "NRM",
			HARD: "HRD",
			INFLUENCE: "INF",
			POLAR: "PLR",
		},
		formatLong: {},
		default: "HARD",
	},

	classes: {
		colour: {
			type: "DERIVED",
			values: PolarisChordColours,
			minimumRelevantValue: "RAINBOW",
		},
	},

	orderedJudgements: ["perfect", "great", "good", "bad", "miss"],

	versions: {
		polarischord: "Polaris Chord",
	},

	chartData: z.strictObject({
		inGameID: zodNonNegativeInt.optional(),
	}),

	preferences: z.strictObject({}),
	scoreMeta: z.strictObject({ mirror: z.boolean().optional() }),

	supportedMatchTypes: ["songTitle", "tachiSongID", "inGameID"],
} as const satisfies INTERNAL_GAME_CONFIG;
