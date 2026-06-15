import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum, FmtPercent } from "../../utils/util";
import { ToDecimalPlaces } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";
import { SDVXVFClasses } from "./sdvx";

export const GAME_GROUP_USC_CONF = {
	name: "USC",
	dynamicContent: true,
	games: ["usc-controller", "usc-keyboard"],
	playtypes: ["Controller", "Keyboard"],
	songData: z.strictObject({}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

export const GAME_USC_CONTROLLER_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 10_000_000),
			formatter: FmtNum,
			goalTitleFormatter: (v) => `Get a score of ${v.toLocaleString("en-GB")} on`,
			goalOutOfFormatter: (v) => v.toLocaleString("en-GB"),
			description: "The score value. This is between 0 and 10 million.",
		},
		lamp: {
			type: "ENUM",
			values: [
				"FAILED",
				"CLEAR",
				"EXCESSIVE CLEAR",
				"ULTIMATE CHAIN",
				"PERFECT ULTIMATE CHAIN",
			],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this score was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: ["D", "C", "B", "A", "A+", "AA", "AA+", "AAA", "AAA+", "S", "PUC"],
			minimumRelevantValue: "A+",
			description: "The grade this score was.",
		},
	},

	defaultMetric: "score",
	preferredDefaultEnum: "grade",

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,
		gauge: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: FmtPercent,
			goalTitleFormatter: (v) => `Get a final gauge of ${v.toFixed(2)}% in`,
			goalOutOfFormatter: (v) => `${v.toFixed(2)}%`,
			description:
				"The amount of life in the gauge when this chart finished. This is between 0 and 100.",
		},
	},

	scoreRatingAlgs: {
		VF6: {
			description: "VOLFORCE as it is implemented in SDVX6.",
			formatter: ToDecimalPlaces(3),
		},
		VF7: {
			description: "VOLFORCE as it is implemented in SDVX7.",
			formatter: ToDecimalPlaces(3),
		},
	},
	sessionRatingAlgs: {
		ProfileVF6: {
			description:
				"The average of your best 10 VF6s this session, multiplied to be on the same scale as profile VOLFORCE.",
			formatter: ToDecimalPlaces(3),
		},
		ProfileVF7: {
			description:
				"The average of your best 10 VF7s this session, multiplied to be on the same scale as profile VOLFORCE.",
			formatter: ToDecimalPlaces(3),
		},
	},
	profileRatingAlgs: {
		VF6: {
			description: "Your best 50 VF6 values added together.",
			formatter: ToDecimalPlaces(3),
			associatedScoreAlgs: ["VF6"],
		},
		VF7: {
			description: "Your best 50 VF7 values added together.",
			formatter: ToDecimalPlaces(3),
			associatedScoreAlgs: ["VF7"],
		},
	},

	defaultScoreRatingAlg: "VF7",
	defaultSessionRatingAlg: "ProfileVF7",
	defaultProfileRatingAlg: "VF7",

	difficulties: {
		type: "FIXED",
		order: ["NOV", "ADV", "EXH", "INF"],
		// deliberately not ported to v3 - formatting of charts as
		// "CON EXH" etc.
		formatShort: {},
		formatLong: {},
		default: "EXH",
	},

	classes: {
		vfClass: {
			type: "DERIVED",
			values: SDVXVFClasses,
			minimumRelevantValue: "IMPERIAL_I",
		},
	},

	orderedJudgements: ["critical", "near", "miss"],

	versions: {},

	chartData: z.strictObject({
		hashSHA1: z.union([z.array(z.string()), z.string()]),
		isOfficial: z.boolean(),
		effector: z.string(),
		tableFolders: z.record(z.string(), z.string()),
	}),

	preferences: z.strictObject({ vf6Target: z.number().optional().nullable() }),
	scoreMeta: z.strictObject({
		noteMod: z.enum(["MIR-RAN", "MIRROR", "NORMAL", "RANDOM"]).optional(),
		gaugeMod: z.enum(["NORMAL", "HARD", "PERMISSIVE"]).optional(),
	}),

	supportedMatchTypes: ["uscChartHash", "tachiSongID"],
} as const satisfies INTERNAL_GAME_CONFIG;

export const GAME_USC_KEYBOARD_CONF = GAME_USC_CONTROLLER_CONF;
