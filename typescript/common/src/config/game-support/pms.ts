import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtPercent, FmtScoreNoCommas } from "../../utils/util";
import { ClassValue, zodNonNegativeInt } from "../config-utils";
import { GAME_BMS_7K_CONF } from "./bms";

export const GAME_PMS_CONF = {
	name: "PMS",
	dynamicContent: true,
	games: ["pms-controller", "pms-keyboard"],
	playtypes: ["Controller", "Keyboard"],
	songData: z.strictObject({
		genre: z.nullable(z.string()),
		subtitle: z.nullable(z.string()),
		subartist: z.nullable(z.string()),
		tableString: z.nullable(z.string()),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

const PMSDans = [
	ClassValue("INSANE_1", "●1", "Insane 1st Dan"),
	ClassValue("INSANE_2", "●2", "Insane 2nd Dan"),
	ClassValue("INSANE_3", "●3", "Insane 3rd Dan"),
	ClassValue("INSANE_4", "●4", "Insane 4th Dan"),
	ClassValue("INSANE_5", "●5", "Insane 5th Dan"),
	ClassValue("INSANE_6", "●6", "Insane 6th Dan"),
	ClassValue("INSANE_7", "●7", "Insane 7th Dan"),
	ClassValue("INSANE_8", "●8", "Insane 8th Dan"),
	ClassValue("INSANE_9", "●9", "Insane 9th Dan"),
	ClassValue("INSANE_10", "●10", "Insane 10th Dan"),
	ClassValue("INSANE_KAIDEN", "●●", "Insane Kaiden"),
	ClassValue("OVERJOY", "●OJ", "Overjoy"),
	ClassValue("UNDEFINED", "●UNDF", "Undefined (Post-Overjoy)"),
];

function FormatSieglindePMS(sgl: number): string {
	if (sgl < 13) {
		return `○${sgl.toFixed(2)}`;
	}

	return `●${(sgl - 12).toFixed(2)}`;
}

export const GAME_PMS_CONTROLLER_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			chartDependentMax: true,
			formatter: FmtScoreNoCommas,
			goalTitleFormatter: (v) => `Get a score of ${v} on`,
			goalOutOfFormatter: (v) => v.toString(),
			description:
				"EX Score. This should be between 0 and the maximum possible EX on this chart.",
		},

		lamp: {
			type: "ENUM",
			values: [
				"NO PLAY",
				"FAILED",
				"ASSIST CLEAR",
				"EASY CLEAR",
				"CLEAR",
				"HARD CLEAR",
				"EX HARD CLEAR",
				"FULL COMBO",
			],
			minimumRelevantValue: "EASY CLEAR",
			description: "The type of clear this was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: ["F", "E", "D", "C", "B", "A", "AA", "AAA", "MAX-", "MAX"],
			minimumRelevantValue: "A",
			description:
				"Grades as they are in IIDX. We also add MAX- (94.44...%) and MAX (100%) as their own grades for convenience.",
		},

		// if #RANDOM is to ever be supported, the user's percent would become
		// a *mandatory* metric, as a chart's notecount can be completely unknown.
		// However, supporting #RANDOM is an awful pain, so I don't really care.
		percent: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: FmtPercent,
			goalTitleFormatter: (v) => `Get ${v.toFixed(2)}% on`,
			goalOutOfFormatter: (v) => `${v.toFixed(2)}%`,
			description: "EX Score divided by the maximum possible EX Score on this chart.",
		},
	},

	defaultMetric: "percent",
	preferredDefaultEnum: "lamp",

	optionalMetrics: {
		...GAME_BMS_7K_CONF.optionalMetrics,
	},

	scoreRatingAlgs: {
		sieglinde: {
			description:
				"A clearing algorithm that rewards you points based on how difficult an easy clear or hard clear was.",
			formatter: FormatSieglindePMS,
		},
	},
	sessionRatingAlgs: {
		sieglinde: {
			description: "The average of your best 10 sieglinde ratings this session.",
			formatter: FormatSieglindePMS,
		},
	},
	profileRatingAlgs: {
		sieglinde: {
			description: "The average of your best 20 sieglinde ratings.",
			formatter: FormatSieglindePMS,
			associatedScoreAlgs: ["sieglinde"],
		},
	},

	defaultScoreRatingAlg: "sieglinde",
	defaultSessionRatingAlg: "sieglinde",
	defaultProfileRatingAlg: "sieglinde",

	// See `bms.ts` for an explanation of why this is like this.
	difficulties: {
		type: "FIXED",
		order: ["CHART"],
		formatShort: {},
		formatLong: {},
		default: "CHART",
	},

	classes: {
		dan: { type: "PROVIDED", values: PMSDans },
	},

	orderedJudgements: ["cool", "great", "good", "bad", "poor"],

	versions: {},

	chartData: z.strictObject({
		notecount: zodNonNegativeInt,
		hashMD5: z.string(),
		hashSHA256: z.string(),
		tableFolders: z.record(z.string(), z.string()),
		sglEC: z.number().nullable().optional(),
		sglHC: z.number().nullable().optional(),
	}),

	preferences: z.strictObject({}),
	scoreMeta: z.strictObject({
		random: z.enum(["MIRROR", "NONRAN", "R-RANDOM", "RANDOM", "S-RANDOM"]).optional(),
		client: z.enum(["beatoraja"]).optional(),
		gauge: z.enum(["EASY", "NORMAL", "HARD", "EX-HARD"]).optional(),
	}),

	supportedMatchTypes: ["bmsChartHash", "tachiSongID"],
} as const satisfies INTERNAL_GAME_CONFIG;

export const GAME_PMS_KEYBOARD_CONF = GAME_PMS_CONTROLLER_CONF;
