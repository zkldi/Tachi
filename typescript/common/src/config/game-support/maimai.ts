import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtPercent } from "../../utils/util";
import { ClassValue, ToDecimalPlaces } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_MAIMAI_CONF = {
	name: "maimai",
	dynamicContent: false,
	games: ["maimai"],
	playtypes: ["Single"],
	songData: z.strictObject({
		titleJP: z.string(),
		artistJP: z.string(),
		displayVersion: z.string(),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

const MaimaiDans = [
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
	ClassValue("KAIDEN", "皆伝", "Kaiden"),

	ClassValue("SHINDAN_1", "真初段", "1st Shindan"),
	ClassValue("SHINDAN_2", "真二段", "2nd Shindan"),
	ClassValue("SHINDAN_3", "真三段", "3rd Shindan"),
	ClassValue("SHINDAN_4", "真四段", "4th Shindan"),
	ClassValue("SHINDAN_5", "真五段", "5th Shindan"),
	ClassValue("SHINDAN_6", "真六段", "6th Shindan"),
	ClassValue("SHINDAN_7", "真七段", "7th Shindan"),
	ClassValue("SHINDAN_8", "真八段", "8th Shindan"),
	ClassValue("SHINDAN_9", "真九段", "9th Shindan"),
	ClassValue("SHINDAN_10", "真十段", "10th Shindan"),
	ClassValue("SHINKAIDEN", "真皆伝", "Shinkaiden"),
];

const MaimaiColours = [
	ClassValue("WHITE", "White", "0 - 1.99 Rating"),
	ClassValue("BLUE", "Blue", "2 - 3.99 Rating"),
	ClassValue("GREEN", "Green", "4 - 6.99 Rating"),
	ClassValue("YELLOW", "Yellow", "7 - 9.99 Rating"),
	ClassValue("RED", "Red", "10 - 11.99 Rating"),
	ClassValue("PURPLE", "Purple", "12 - 12.99 Rating"),
	ClassValue("BRONZE", "Bronze", "13 - 13.99 Rating"),
	ClassValue("SILVER", "Silver", "14 - 14.49 Rating"),
	ClassValue("GOLD", "Gold", "14.5 - 14.99 Rating"),
	ClassValue("RAINBOW", "Rainbow", ">=15 Rating"),
];

export const GAME_MAIMAI_CONF = {
	providedMetrics: {
		percent: {
			type: "DECIMAL",
			chartDependentMax: true,
			allowFolderGoalsIf: (v) => v >= 0 && v < 100.0,
			validate: p.isPositive,
			formatter: FmtPercent,
			description:
				"The percent this score was worth. Sometimes called 'rate' in game. This is upper-bounded by how many BREAK notes the chart has.",
		},
		lamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "FULL COMBO", "ALL PERFECT", "ALL PERFECT+"],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this score was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: [
				"F",
				"E",
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
			],
			minimumRelevantValue: "A",
			description: "The grade this score was.",
		},
	},

	defaultMetric: "percent",
	preferredDefaultEnum: "grade",

	optionalMetrics: FAST_SLOW_MAXCOMBO,

	scoreRatingAlgs: {
		rate: { description: "Rating as it's implemented in game.", formatter: ToDecimalPlaces(2) },
	},
	sessionRatingAlgs: {
		rate: {
			description: "The average of your best 10 ratings this session.",
			formatter: ToDecimalPlaces(2),
		},
	},
	profileRatingAlgs: {
		naiveRate: {
			description:
				"An average of your 30 best ratings. This is different from the rating in-game, as that is song-based and takes into account recent scores.",
			formatter: ToDecimalPlaces(2),
			associatedScoreAlgs: ["rate"],
		},
	},

	defaultScoreRatingAlg: "rate",
	defaultSessionRatingAlg: "rate",
	defaultProfileRatingAlg: "naiveRate",

	difficulties: {
		type: "CHUGEKIMAI_STYLE",
		order: ["Easy", "Basic", "Advanced", "Expert", "Master", "Re:Master"],
		formatShort: {
			Easy: "ESY",
			Basic: "BAS",
			Advanced: "ADV",
			Expert: "EXP",
			Master: "MAS",
			"Re:Master": "Re:MAS",
		},
		formatLong: {},
		default: "Master",
	},

	classes: {
		colour: {
			type: "DERIVED",
			values: MaimaiColours,
			minimumScores: 30,
		},
		dan: {
			type: "PROVIDED",
			values: MaimaiDans,
		},
	},

	orderedJudgements: ["perfect", "great", "good", "miss"],

	versions: {
		finale: "FiNALE",
	},

	chartData: z.strictObject({
		inGameID: z.number(),
		inGameStrID: z.string(),
		maxPercent: z.number(),
	}),

	preferences: z.strictObject({}),
	scoreMeta: z.strictObject({}),

	supportedMatchTypes: [
		"gcmInGameIDSpecialChart",
		"songTitle",
		"tachiSongID",
		"inGameID",
		"inGameStrID",
	],
} as const satisfies INTERNAL_GAME_CONFIG;
