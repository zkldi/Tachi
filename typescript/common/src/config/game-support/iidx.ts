import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum, FmtPercent, FmtScoreNoCommas } from "../../utils/util";
import { ClassValue, zodNonNegativeInt, zodTierlistData } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_IIDX_CONF = {
	games: ["iidx-sp", "iidx-dp"],
	name: "beatmania IIDX",
	dynamicContent: false,
	playtypes: ["SP", "DP"],
	songData: z.strictObject({
		genre: z.string(),
		displayVersion: z.nullable(z.string()),

		// Sometimes, the titles in the e-amusement CSV are different from the titles in the database.
		eamusementCsvTitle: z.optional(z.string()),
		eamusementCsvArtist: z.optional(z.string()),
		eamusementCsvGenre: z.optional(z.string()),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

export const IIDXDans = [
	ClassValue("KYU_7", "七級", "7th Kyu"),
	ClassValue("KYU_6", "六級", "6th Kyu"),
	ClassValue("KYU_5", "五級", "5th Kyu"),
	ClassValue("KYU_4", "四級", "4th Kyu"),
	ClassValue("KYU_3", "三級", "3rd Kyu"),
	ClassValue("KYU_2", "二級", "2nd Kyu"),
	ClassValue("KYU_1", "一級", "1st Kyu"),
	ClassValue("DAN_1", "初段", "1st Dan"),
	ClassValue("DAN_2", "二段", "2nd Dan"),
	ClassValue("DAN_3", "三段", "3rd Dan"),
	ClassValue("DAN_4", "四段", "4th Dan"),
	ClassValue("DAN_5", "五段", "5th Dan"),
	ClassValue("DAN_6", "六段", "6th Dan"),
	ClassValue("DAN_7", "七段", "7th Dan"),
	ClassValue("DAN_8", "八段", "8th Dan"),
	ClassValue("DAN_9", "九段", "9th Dan"),
	ClassValue("DAN_10", "十段", "10th Dan"),
	ClassValue("CHUUDEN", "中伝", "Chuuden"),
	ClassValue("KAIDEN", "皆伝", "Kaiden"),
];

const BASE_IIDX_CHART_DATA = {
	notecount: zodNonNegativeInt,
	inGameID: z.union([z.array(z.number().int()), z.number().int()]),
	hashSHA256: z.string().nullable(),
	"2dxtraSet": z.string().nullable(),
	kaidenAverage: z.number().int().positive().nullable(),
	worldRecord: z.number().int().positive().nullable(),
	bpiCoefficient: z.number().positive().nullable(),
};

const RANDOM_SCHEMA = z.enum(["NONRAN", "MIRROR", "R-RANDOM", "RANDOM", "S-RANDOM"]);

export const GAME_IIDX_SP_CONF = {
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
		percent: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: FmtPercent,
			goalTitleFormatter: (v) => `Get ${v.toFixed(2)}% on`,
			goalOutOfFormatter: (v) => `${v.toFixed(2)}%`,
			description: "EX Score divided by the maximum possible EX Score on this chart.",
		},
		grade: {
			type: "ENUM",
			values: ["F", "E", "D", "C", "B", "A", "AA", "AAA", "MAX-", "MAX"],
			minimumRelevantValue: "A",
			description:
				"Grades as they are in IIDX. We also add MAX- (94.44...%) and MAX (100%) as their own grades for convenience.",
		},
	},

	defaultMetric: "percent",
	preferredDefaultEnum: "lamp",

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,

		bp: {
			type: "INTEGER",
			validate: p.isPositive,
			formatter: FmtScoreNoCommas,
			goalTitleFormatter: (v) => `Get a BP of ${v} in`,
			goalOutOfFormatter: (v) => v.toString(),
			description: "The total bads + poors in this score.",
		},
		gauge: {
			type: "DECIMAL",
			validate: p.isBetween(0, 100),
			formatter: FmtPercent,
			goalTitleFormatter: (v) => `Get a final gauge of ${v.toFixed(2)}% in`,
			goalOutOfFormatter: (v) => `${v.toFixed(2)}%`,
			description:
				"The life in percent (between 0 and 100) that was on the gauge at the end of the chart.",
		},
		comboBreak: {
			type: "INTEGER",
			validate: p.isPositive,
			formatter: FmtNum,
			goalTitleFormatter: (v) => `Get ${v} combo breaks in`,
			goalOutOfFormatter: (v) => v.toLocaleString("en-GB"),
			description: "The amount of times combo was broken.",
		},

		// The players history for the gauge type they were playing on.
		// this may fall into "NULL" if the user fails.
		gaugeHistory: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description:
				"A snapshot of the gauge percent throughout the chart. The values should be null from the point the user dies until the end of the chart.",
		},
		scoreHistory: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description:
				"A snapshot of the user's ghost throughout the chart. The values may be null.",
		},

		// if "GSM" is enabled (via fervidex.dll) then all graphs
		// are sent. we should store all of them.
		gsmEasy: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description: "If GSM is used, this stores the easy gauge history.",
		},
		gsmNormal: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description: "If GSM is used, this stores the normal gauge history.",
		},
		gsmHard: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description: "If GSM is used, this stores the hard gauge history.",
		},
		gsmEXHard: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description: "If GSM is used, this stores the ex-hard gauge history.",
		},
	},

	defaultScoreRatingAlg: "ktLampRating",
	defaultSessionRatingAlg: "ktLampRating",
	defaultProfileRatingAlg: "ktLampRating",

	scoreRatingAlgs: {
		ktLampRating: {
			description:
				"A rating system that values your clear lamps on charts. Tierlist information is taken into account.",
		},
		ktLampRatingHC: {
			description: "Your hard clear performance. Tierlist information is taken into account.",
		},
		ktLampRatingEXHC: {
			description:
				"Your EX-hard clear performance. Tierlist information is taken into account.",
		},
		BPI: {
			description:
				"A rating system for Kaiden level play. Only applies to 11s and 12s. A BPI of 0 states the score is equal to the Kaiden Average for that chart. A BPI of 100 is equal to the world record.",
		},
	},

	profileRatingAlgs: {
		ktLampRating: {
			description: `An average of your best 20 ktLampRatings.`,
			associatedScoreAlgs: ["ktLampRating"],
			displayOrder: 0,
		},
		ktLampRatingHC: {
			description: `An average of your best 20 ktLampRatingHCs.`,
			associatedScoreAlgs: ["ktLampRatingHC"],
			displayOrder: 1,
		},
		ktLampRatingEXHC: {
			description: `An average of your best 20 ktLampRatingEXHCs.`,
			associatedScoreAlgs: ["ktLampRatingEXHC"],
			displayOrder: 2,
		},
		BPI: {
			description: `An average of your best 20 BPIs.`,
			associatedScoreAlgs: ["BPI"],
			displayOrder: 3,
		},
	},
	sessionRatingAlgs: {
		ktLampRating: { description: `An average of the best 10 ktLampRatings this session.` },
		ktLampRatingHC: { description: `An average of the best 10 ktLampRatingHCs this session.` },
		ktLampRatingEXHC: {
			description: `An average of the best 10 ktLampRatingEXHCs this session.`,
		},
		BPI: { description: `An average of the best 10 BPIs this session.` },
	},

	difficulties: {
		type: "FIXED",
		order: [
			"NORMAL",
			"HYPER",
			"ANOTHER",
			"LEGGENDARIA",
			"All Scratch NORMAL",
			"All Scratch HYPER",
			"All Scratch ANOTHER",
			"All Scratch LEGGENDARIA",
			"Kichiku NORMAL",
			"Kichiku HYPER",
			"Kichiku ANOTHER",
			"Kichiku LEGGENDARIA",
			"Kiraku NORMAL",
			"Kiraku HYPER",
			"Kiraku ANOTHER",
			"Kiraku LEGGENDARIA",
		],
		formatShort: {
			NORMAL: "SPN",
			HYPER: "SPH",
			ANOTHER: "SPA",
			LEGGENDARIA: "SPL",
			"All Scratch NORMAL": "SPN (Scr.)",
			"All Scratch HYPER": "SPH (Scr.)",
			"All Scratch ANOTHER": "SPA (Scr.)",
			"All Scratch LEGGENDARIA": "SPL (Scr.)",
			"Kichiku NORMAL": "SPN (Kc.)",
			"Kichiku HYPER": "SPH (Kc.)",
			"Kichiku ANOTHER": "SPA (Kc.)",
			"Kichiku LEGGENDARIA": "SPL (Kc.)",
			"Kiraku NORMAL": "SPN (Kr.)",
			"Kiraku HYPER": "SPH (Kr.)",
			"Kiraku ANOTHER": "SPA (Kr.)",
			"Kiraku LEGGENDARIA": "SPL (Kr.)",
		},
		formatLong: {
			NORMAL: "SP NORMAL",
			HYPER: "SP HYPER",
			ANOTHER: "SP ANOTHER",
			LEGGENDARIA: "SP LEGGENDARIA",

			// deliberately short
			"All Scratch NORMAL": "SPN (Scr.)",
			"All Scratch HYPER": "SPH (Scr.)",
			"All Scratch ANOTHER": "SPA (Scr.)",
			"All Scratch LEGGENDARIA": "SPL (Scr.)",
			"Kichiku NORMAL": "SPN (Kc.)",
			"Kichiku HYPER": "SPH (Kc.)",
			"Kichiku ANOTHER": "SPA (Kc.)",
			"Kichiku LEGGENDARIA": "SPL (Kc.)",
			"Kiraku NORMAL": "SPN (Kr.)",
			"Kiraku HYPER": "SPH (Kr.)",
			"Kiraku ANOTHER": "SPA (Kr.)",
			"Kiraku LEGGENDARIA": "SPL (Kr.)",
		},
		default: "ANOTHER",
	},

	classes: {
		dan: {
			type: "PROVIDED",
			values: IIDXDans,
		},
	},

	orderedJudgements: ["pgreat", "great", "good", "bad", "poor"],

	/* eslint-disable quote-props */
	versions: {
		"3-cs": "3rd Style CS",
		"4-cs": "4th Style CS",
		"5-cs": "5th Style CS",
		"6-cs": "6th Style CS",
		"7-cs": "7th Style CS",
		"8-cs": "8th Style CS",
		"9-cs": "9th Style CS",
		"10-cs": "10th Style CS",
		"11-cs": "IIDX RED CS",
		"12-cs": "HAPPY SKY CS",
		"13-cs": "DISTORTED CS",
		"14-cs": "GOLD CS",
		"15-cs": "DJ TROOPERS CS",
		"16-cs": "EMPRESS CS",
		"20": "tricoro",
		"21": "SPADA",
		"22": "PENDUAL",
		"23": "copula",
		"24": "SINOBUZ",
		"25": "CANNON BALLERS",
		"26": "ROOTAGE",
		"27": "HEROIC VERSE",
		"28": "BISTROVER",
		"29": "CastHour",
		"30": "Resident",
		"31": "Epolis",
		"32": "Pinky Crush",
		"33": "Sparkle Shower",
		"26-omni": "ROOTAGE Omnimix",
		"27-omni": "HEROIC VERSE Omnimix",
		"28-omni": "BISTROVER Omnimix",
		"29-omni": "CastHour Omnimix",
		"30-omni": "Resident Omnimix",
		"31-omni": "Epolis Omnimix",
		"32-omni": "Pinky Crush Omnimix",
		"27-2dxtra": "HEROIC VERSE 2dxtra",
		"28-2dxtra": "BISTROVER 2dxtra",
		"30-2dxtra": "RESIDENT 2dxtra",
		"31-2dxtra": "Epolis 2dxtra",
		bmus: "BEATMANIA US",
		inf: "INFINITAS",
	},
	/* eslint-enable quote-props */

	chartData: z.strictObject({
		...BASE_IIDX_CHART_DATA,
		ncTier: zodTierlistData,
		hcTier: zodTierlistData,
		exhcTier: zodTierlistData,
	}),

	preferences: z.strictObject({
		display2DXTra: z.boolean().optional().nullable(),
		bpiTarget: z.number().lte(100).gte(-15).optional().nullable(),
	}),

	scoreMeta: z.strictObject({
		random: RANDOM_SCHEMA.optional(),
		assist: z.enum(["AUTO SCRATCH", "LEGACY NOTE", "NO ASSIST", "FULL ASSIST"]).optional(),
		range: z.enum(["NONE", "HIDDEN+", "SUDDEN+", "LIFT", "LIFT SUD+", "SUD+ HID+"]).optional(),
		gauge: z.enum(["ASSISTED EASY", "EASY", "NORMAL", "HARD", "EX-HARD"]).optional(),
	}),

	supportedMatchTypes: ["inGameID", "tachiSongID", "songTitle"],
} as const satisfies INTERNAL_GAME_CONFIG;

export const GAME_IIDX_DP_CONF = {
	...GAME_IIDX_SP_CONF,

	chartData: z.strictObject({
		...BASE_IIDX_CHART_DATA,

		dpTier: zodTierlistData,
	}),

	scoreMeta: z.strictObject({
		random: z.tuple([RANDOM_SCHEMA, RANDOM_SCHEMA]).optional(),
		assist: z.enum(["AUTO SCRATCH", "LEGACY NOTE", "NO ASSIST", "FULL ASSIST"]).optional(),
		range: z.enum(["NONE", "HIDDEN+", "SUDDEN+", "LIFT", "LIFT SUD+", "SUD+ HID+"]).optional(),
		gauge: z.enum(["ASSISTED EASY", "EASY", "NORMAL", "HARD", "EX-HARD"]).optional(),
	}),

	difficulties: {
		type: "FIXED",
		order: [
			"NORMAL",
			"HYPER",
			"ANOTHER",
			"LEGGENDARIA",
			"All Scratch NORMAL",
			"All Scratch HYPER",
			"All Scratch ANOTHER",
			"All Scratch LEGGENDARIA",
			"Kichiku NORMAL",
			"Kichiku HYPER",
			"Kichiku ANOTHER",
			"Kichiku LEGGENDARIA",
			"Kiraku NORMAL",
			"Kiraku HYPER",
			"Kiraku ANOTHER",
			"Kiraku LEGGENDARIA",
		],
		formatShort: {
			NORMAL: "DPN",
			HYPER: "DPH",
			ANOTHER: "DPA",
			LEGGENDARIA: "DPL",
			"All Scratch NORMAL": "DPN (Scr.)",
			"All Scratch HYPER": "DPH (Scr.)",
			"All Scratch ANOTHER": "DPA (Scr.)",
			"All Scratch LEGGENDARIA": "DPL (Scr.)",
			"Kichiku NORMAL": "DPN (Kc.)",
			"Kichiku HYPER": "DPH (Kc.)",
			"Kichiku ANOTHER": "DPA (Kc.)",
			"Kichiku LEGGENDARIA": "DPL (Kc.)",
			"Kiraku NORMAL": "DPN (Kr.)",
			"Kiraku HYPER": "DPH (Kr.)",
			"Kiraku ANOTHER": "DPA (Kr.)",
			"Kiraku LEGGENDARIA": "DPL (Kr.)",
		},
		formatLong: {
			NORMAL: "DP NORMAL",
			HYPER: "DP HYPER",
			ANOTHER: "DP ANOTHER",
			LEGGENDARIA: "DP LEGGENDARIA",

			// deliberately short
			"All Scratch NORMAL": "DPN (Scr.)",
			"All Scratch HYPER": "DPH (Scr.)",
			"All Scratch ANOTHER": "DPA (Scr.)",
			"All Scratch LEGGENDARIA": "DPL (Scr.)",
			"Kichiku NORMAL": "DPN (Kc.)",
			"Kichiku HYPER": "DPH (Kc.)",
			"Kichiku ANOTHER": "DPA (Kc.)",
			"Kichiku LEGGENDARIA": "DPL (Kc.)",
			"Kiraku NORMAL": "DPN (Kr.)",
			"Kiraku HYPER": "DPH (Kr.)",
			"Kiraku ANOTHER": "DPA (Kr.)",
			"Kiraku LEGGENDARIA": "DPL (Kr.)",
		},
		default: "ANOTHER",
	},
} as const satisfies INTERNAL_GAME_CONFIG;
