import { FAST_SLOW_MAXCOMBO } from "./_common";
import { FmtNum, FmtStars } from "../../utils/util";
import { ClassValue, ToDecimalPlaces } from "../config-utils";
import { p } from "prudence";
import { z } from "zod";
import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_PT_CONFIG } from "../../types/internals";

export const ONGEKI_CONF = {
	name: "O.N.G.E.K.I.",
	playtypes: ["Single"],
	songData: z.strictObject({
		genre: z.enum([
			"POPS＆ANIME",
			"niconico",
			"東方Project",
			"VARIETY",
			"チュウマイ",
			"オンゲキ",
			"LUNATIC",
			"ボーナストラック",
		]),
		duration: z.number().nullable(),
		flavorGenre: z.string().optional(),
	}),
} as const satisfies INTERNAL_GAME_CONFIG;

export const OngekiColours = [
	ClassValue("BLUE", "水", "Blue: 0.000~3.999 Rating"),
	ClassValue("GREEN", "緑", "Green: 4.000~6.999 Rating"),
	ClassValue("ORANGE", "橙", "Orange: 7.000~8.999 Rating"),
	ClassValue("RED", "赤", "Red: 9.000~10.999 Rating"),
	ClassValue("PURPLE", "紫", "Purple: 11.000~12.999 Rating"),
	ClassValue("COPPER", "銅", "Copper: 13.000~14.999 Rating"),
	ClassValue("SILVER", "銀", "Silver: 15.000~16.999 Rating"),
	ClassValue("GOLD", "金", "Gold: 17.000~17.999 Rating"),
	ClassValue("PLATINUM", "鉑", "Platinum: 18.000~18.999 Rating"),
	ClassValue("RAINBOW", "虹", "Rainbow: 19.000~19.999 Rating"),
	ClassValue("RAINBOW_SHINY", "虹(光)", "Rainbow Shiny: 20.000~20.999 Rating"),
	ClassValue("RAINBOW_EX", "虹(極)", "Rainbow Extreme: 21.000~21.999 Rating"),
	ClassValue("RAINBOW_EX_TRUE", "虹(極)・真", "Rainbow Extreme (True): 22.000~ Rating"),
];

export const ONGEKI_SINGLE_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_010_000),
			formatter: FmtNum,
			description:
				"Known in-game as 'Technical Score'. It ranges between 0 and 1,010,000, where notes are worth 950,000, and bells 60,000.",
		},
		noteLamp: {
			type: "ENUM",
			values: ["LOSS", "CLEAR", "FULL COMBO", "ALL BREAK", "ALL BREAK+"],
			minimumRelevantValue: "CLEAR",
			description: "The primary lamp. A clear is either a draw or a win.",
		},
		bellLamp: {
			type: "ENUM",
			values: ["NONE", "FULL BELL"],
			minimumRelevantValue: "FULL BELL",
			description: "Tracks whether all bells in the chart have been collected.",
		},
		platinumScore: {
			type: "INTEGER",
			chartDependentMax: true,
			formatter: FmtNum,
			description:
				"The Platinum Score value, similar to the scoring system used in beatmania IIDX.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: ["D", "C", "B", "BB", "BBB", "A", "AA", "AAA", "S", "SS", "SSS", "SSS+"],
			minimumRelevantValue: "A",
			description: "The grade this score was.",
		},
		platinumStars: {
			type: "INTEGER",
			validate: p.isBetween(0, 6),
			formatter: FmtStars,
			description: "The number of platinum stars of this score",
		},
	},

	defaultMetric: "score",
	preferredDefaultEnum: "grade",

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,
		damage: {
			type: "INTEGER",
			chartDependentMax: true,
			formatter: FmtNum,
			description: "The number of damage ticks received.",
			partOfScoreID: true,
		},
		bellCount: {
			type: "INTEGER",
			chartDependentMax: true,
			formatter: FmtNum,
			description: "The number of bells collected.",
			partOfScoreID: true,
		},
		totalBellCount: {
			type: "INTEGER",
			chartDependentMax: true,
			formatter: FmtNum,
			description: "The total number of bells.",
		},
		scoreGraph: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 1010000),
			description: "The history of the projected score, queried in one-second intervals.",
		},
		platinumGraph: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(-100000, 0),
			description: "The Platinum Score history, queried in one-second intervals.",
		},
		bellGraph: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(-10000, 0),
			description:
				"The history of the number of bells missed, queried in one-second intervals.",
		},
		lifeGraph: {
			type: "NULLABLE_GRAPH",
			validate: p.isBetween(0, 100),
			description: "The life gauge history, queried in one-second intervals.",
		},
	},

	scoreRatingAlgs: {
		rating: {
			description: "Technical Score-based rating as it's implemented in bright MEMORY.",
			formatter: ToDecimalPlaces(2),
		},
		scoreRating: {
			description: "Technical Score-based rating as it's implemented in Re:Fresh.",
			formatter: ToDecimalPlaces(3),
		},
		starRating: {
			description: "Platinum Stars-based rating as it's implemented in Re:Fresh.",
			formatter: ToDecimalPlaces(3),
		},
	},
	sessionRatingAlgs: {
		naiveRating: {
			description: "The average of your best 10 classic ratings this session.",
			formatter: ToDecimalPlaces(2),
		},
		naiveScoreRating: {
			description: "The average of your best 10 score ratings this session.",
			formatter: ToDecimalPlaces(3),
		},
		starRating: {
			description: "The average of your best 10 star ratings this session.",
			formatter: ToDecimalPlaces(3),
		},
	},
	profileRatingAlgs: {
		naiveRating: {
			description:
				"The average of your best 45 ClassicRatings. This is a simpler variant of the rating algorithm used in bright MEMORY and earlier versions, without distinguishing between new and old charts, and without taking recent scores into account.",
			formatter: ToDecimalPlaces(2),
			associatedScoreAlgs: ["rating"],
		},
		naiveRatingRefresh: {
			description:
				"A weighted sum of the average of your best 60 ScoreRatings, and your best 50 StarRatings. This is a simpler variant of the rating algorithm used in Re:Fresh, without distinguishing between new and old charts.",
			formatter: ToDecimalPlaces(3),
			associatedScoreAlgs: ["scoreRating", "starRating"],
		},
	},

	defaultScoreRatingAlg: "rating",
	defaultSessionRatingAlg: "naiveRating",
	defaultProfileRatingAlg: "naiveRating",

	difficulties: {
		type: "FIXED",
		order: ["BASIC", "ADVANCED", "EXPERT", "MASTER", "LUNATIC"],
		shorthand: {
			BASIC: "BAS",
			ADVANCED: "ADV",
			EXPERT: "EXP",
			MASTER: "MAS",
			LUNATIC: "LUN",
		},
		default: "MASTER",
	},

	classes: {
		colour: {
			type: "DERIVED",
			values: OngekiColours,
			minimumRelevantValue: "RAINBOW",
		},
	},

	orderedJudgements: ["cbreak", "break", "hit", "miss"],

	versions: {
		brightMemory2Omni: "bright MEMORY Act.II Omnimix",
		brightMemory3: "bright MEMORY Act.III",
		brightMemory3Omni: "bright MEMORY Act.III Omnimix",
		refresh: "Re:Fresh",
		refreshOmni: "Re:Fresh Omnimix",
	},

	chartData: z.strictObject({
		displayVersion: z.enum([
			"オンゲキ",
			"オンゲキ PLUS",
			"オンゲキ SUMMER",
			"オンゲキ SUMMER PLUS",
			"オンゲキ R.E.D.",
			"オンゲキ R.E.D. PLUS",
			"オンゲキ bright",
			"オンゲキ bright MEMORY Act.1",
			"オンゲキ bright MEMORY Act.2",
			"オンゲキ bright MEMORY Act.3",
			"オンゲキ Re:Fresh",
		]),
		isBonusTrack: z.boolean(),
		isReMaster: z.boolean().optional(),
		maxPlatScore: z.number().int().nonnegative(),
		inGameID: z.number().int().nonnegative().nullable(),
		chartViewURL: z.string().optional(),
	}),

	preferences: z.strictObject({}),

	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["songTitle", "tachiSongID", "inGameID"],
} as const satisfies INTERNAL_GAME_PT_CONFIG;
