import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtPercent } from "../../utils/util";
import { ClassValue, NoDecimalPlace } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_MAIMAI_DX_CONF = {
	name: "maimai DX",
	dynamicContent: false,
	games: ["maimaidx"],
	playtypes: ["Single"],
	songData: z.strictObject({
		genre: z.string(),
		duration: z.number().optional(),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

const MaimaiDXDans = [
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

	ClassValue("URAKAIDEN", "裏皆伝", "Urakaiden"),
];

const MaimaiDXColours = [
	ClassValue("WHITE", "白", "White: 0 - 999 Rating"),
	ClassValue("BLUE", "青", "Blue: 1000 - 1999 Rating"),
	ClassValue("GREEN", "緑", "Green: 2000 - 3999 Rating"),
	ClassValue("YELLOW", "黄", "Yellow: 4000 - 6999 Rating"),
	ClassValue("RED", "赤", "Red: 7000 - 9999 Rating"),
	ClassValue("PURPLE", "紫", "Purple: 10000 - 11999 Rating"),
	ClassValue("BRONZE", "銅", "Bronze: 12000 - 12999 Rating"),
	ClassValue("SILVER", "銀", "Silver: 13000 - 13999 Rating"),
	ClassValue("GOLD", "金 ★", "Gold I: 14000 - 14249 Rating"),
	ClassValue("GOLD_II", "金 ★★", "Gold II: 14250 - 14499 Rating"),
	ClassValue("PLATINUM", "白金 ★", "Platinum I: 14500 - 14749 Rating"),
	ClassValue("PLATINUM_II", "白金 ★★", "Platinum II: 14750 - 14999 Rating"),
	ClassValue("RAINBOW", "虹 ★", "Rainbow I: 15000 - 15249 Rating"),
	ClassValue("RAINBOW_II", "虹 ★★", "Rainbow II: 15250 - 15499 Rating"),
	ClassValue("RAINBOW_III", "虹 ★★★", "Rainbow III: 15500 - 15749 Rating"),
	ClassValue("RAINBOW_IV", "虹 ★★★★", "Rainbow IV: 15750 - 15999 Rating"),
	ClassValue("RAINBOW_EX_I", "虹 (極) ★", "Rainbow Extreme I: 16000 - 16249 Rating"),
	ClassValue("RAINBOW_EX_II", "虹 (極) ★★", "Rainbow Extreme II: 16250 - 16499 Rating"),
	ClassValue("RAINBOW_EX_III", "虹 (極) ★★★", "Rainbow Extreme III: 16500 - 16749 Rating"),
	ClassValue("RAINBOW_EX_IV", "虹 (極) ★★★★", "Rainbow Extreme IV: >=16750 Rating"),
];

const MaimaiDXMatchingClasses = [
	ClassValue("B5", "B5"),
	ClassValue("B4", "B4"),
	ClassValue("B3", "B3"),
	ClassValue("B2", "B2"),
	ClassValue("B1", "B1"),

	ClassValue("A5", "A5"),
	ClassValue("A4", "A4"),
	ClassValue("A3", "A3"),
	ClassValue("A2", "A2"),
	ClassValue("A1", "A1"),

	ClassValue("S5", "S5"),
	ClassValue("S4", "S4"),
	ClassValue("S3", "S3"),
	ClassValue("S2", "S2"),
	ClassValue("S1", "S1"),

	ClassValue("SS5", "SS5"),
	ClassValue("SS4", "SS4"),
	ClassValue("SS3", "SS3"),
	ClassValue("SS2", "SS2"),
	ClassValue("SS1", "SS1"),

	ClassValue("SSS5", "SSS5"),
	ClassValue("SSS4", "SSS4"),
	ClassValue("SSS3", "SSS3"),
	ClassValue("SSS2", "SSS2"),
	ClassValue("SSS1", "SSS1"),

	ClassValue("LEGEND", "Legend"),
];

export const GAME_MAIMAI_DX_CONF = {
	providedMetrics: {
		percent: {
			type: "DECIMAL",
			validate: p.isBetween(0, 101),
			formatter: (v) => FmtPercent(v, 4),
			description:
				"The percent this score was worth. Sometimes called 'rate' in game. This is between 0 and 101.",
		},
		lamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "FULL COMBO", "FULL COMBO+", "ALL PERFECT", "ALL PERFECT+"],
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

	defaultMetric: "percent",
	preferredDefaultEnum: "grade",

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,
		percentGraph: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 101),
			description:
				"The history of the projected achievement, queried in one-second intervals.",
		},
		lifeGraph: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 999),
			description: "Life count history, queried in one-second intervals.",
		},
	},

	scoreRatingAlgs: {
		rate: { description: "Rating as it's implemented in game.", formatter: NoDecimalPlace },
	},
	sessionRatingAlgs: {
		rate: {
			description: "The average of your best 10 ratings this session.",
			formatter: NoDecimalPlace,
		},
	},
	profileRatingAlgs: {
		naiveRate: {
			description: "A naive rating algorithm that just sums your 50 best scores.",
			formatter: NoDecimalPlace,
			associatedScoreAlgs: ["rate"],
		},
	},

	defaultScoreRatingAlg: "rate",
	defaultSessionRatingAlg: "rate",
	defaultProfileRatingAlg: "naiveRate",

	difficulties: {
		type: "CHUGEKIMAI_STYLE",
		order: [
			"Basic",
			"Advanced",
			"Expert",
			"Master",
			"Re:Master",
			"DX Basic",
			"DX Advanced",
			"DX Expert",
			"DX Master",
			"DX Re:Master",
		],
		formatShort: {
			Basic: "BAS",
			Advanced: "ADV",
			Expert: "EXP",
			Master: "MAS",
			"Re:Master": "Re:MAS",
			"DX Basic": "DX BAS",
			"DX Advanced": "DX ADV",
			"DX Expert": "DX EXP",
			"DX Master": "DX MAS",
			"DX Re:Master": "DX Re:MAS",
		},
		formatLong: {},
		default: "Master",
	},

	classes: {
		colour: {
			type: "DERIVED",
			values: MaimaiDXColours,
			minimumRelevantValue: "BRONZE",
		},
		dan: {
			type: "PROVIDED",
			values: MaimaiDXDans,
		},
		matchingClass: {
			type: "PROVIDED",
			values: MaimaiDXMatchingClasses,
		},
	},

	orderedJudgements: ["pcrit", "perfect", "great", "good", "miss"],

	versions: {
		universeplus: "UNiVERSE PLUS",
		festival: "FESTiVAL",
		festivalplus: "FESTiVAL PLUS",
		buddies: "BUDDiES",
		"buddies-omni": "BUDDiES Omnimix",
		buddiesplus: "BUDDiES PLUS",
		"buddiesplus-omni": "BUDDiES PLUS Omnimix",
		prism: "PRiSM",
		"prism-omni": "PRiSM Omnimix",
		prismplus: "PRiSM PLUS",
		"prismplus-omni": "PRiSM PLUS Omnimix",
		circle: "CiRCLE",
	},

	chartData: z.strictObject({
		displayVersion: z.string(),
		inGameID: z.number().int().nonnegative().nullable(),
	}),

	preferences: z.strictObject({}),
	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["gcmInGameIDSpecialChart", "songTitle", "tachiSongID", "inGameID"],
} as const satisfies INTERNAL_GAME_CONFIG;
