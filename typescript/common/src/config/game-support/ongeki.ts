import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum } from "../../utils/util";
import { ClassValue, ToDecimalPlaces } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_ONGEKI_CONF = {
	name: "O.N.G.E.K.I.",
	dynamicContent: false,
	games: ["ongeki"],
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
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

export const OngekiColours = [
	ClassValue("BLUE", "水", "Blue: 0.000~3.999 RatingRefresh"),
	ClassValue("GREEN", "緑", "Green: 4.000~6.999 RatingRefresh"),
	ClassValue("ORANGE", "橙", "Orange: 7.000~8.999 RatingRefresh"),
	ClassValue("RED", "赤", "Red: 9.000~10.999 RatingRefresh"),
	ClassValue("PURPLE", "紫", "Purple: 11.000~12.999 RatingRefresh"),
	ClassValue("COPPER", "銅", "Copper: 13.000~14.999 RatingRefresh"),
	ClassValue("SILVER", "銀", "Silver: 15.000~16.999 RatingRefresh"),
	ClassValue("GOLD", "金", "Gold: 17.000~17.999 RatingRefresh"),
	ClassValue("PLATINUM", "鉑", "Platinum: 18.000~18.999 RatingRefresh"),
	ClassValue("RAINBOW", "虹", "Rainbow: 19.000~19.999 RatingRefresh"),
	ClassValue("RAINBOW_SHINY", "虹(光)", "Rainbow Shiny: 20.000~20.999 RatingRefresh"),
	ClassValue("RAINBOW_EX", "虹(極)", "Rainbow Extreme: 21.000~21.999 RatingRefresh"),
	ClassValue("RAINBOW_EX_TRUE", "虹(極)・真", "Rainbow Extreme (True): 22.000~ RatingRefresh"),
];

export type StarEnum = "0-star" | "1-star" | "2-star" | "3-star" | "4-star" | "5-star" | "R-star";

export const StarEnumToInt = (v: StarEnum) => (v === "R-star" ? 6 : parseInt(v[0], 10));

export const FmtStars = (v: number | StarEnum, compact: boolean) => {
	const n = typeof v === "number" ? v : StarEnumToInt(v);
	if (n > 5) {
		return "★★★★★(虹)";
	}
	return `${"★".repeat(n)}${"☆".repeat(compact ? 0 : 5 - n)}`;
};

export const GAME_ONGEKI_CONF = {
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
			type: "ENUM",
			values: ["0-star", "1-star", "2-star", "3-star", "4-star", "5-star", "R-star"],
			minimumRelevantValue: "1-star",
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
			description: "The average of your best 10 ClassicRatings this session.",
			formatter: ToDecimalPlaces(2),
		},
		naiveScoreRating: {
			description: "The average of your best 10 ScoreRatings this session.",
			formatter: ToDecimalPlaces(3),
		},
		starRating: {
			description: "The average of your best 10 StarRatings this session.",
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
			description: `A weighted average of your best 60 ScoreRatings and 50 StarRatings:

				NaiveRatingRefresh = ScoreRating x 1.2 + StarRating

				This is a simpler variant of the rating algorithm used in Re:Fresh, without distinguishing between new and old charts.`,
			formatter: ToDecimalPlaces(3),
			associatedScoreAlgs: ["scoreRating", "starRating"],
		},
		scoreRating: {
			description: "The average of your best 60 ScoreRatings.",
			formatter: ToDecimalPlaces(3),
			associatedScoreAlgs: ["scoreRating"],
		},
		starRating: {
			description: "The average of your best 50 StarRatings.",
			formatter: ToDecimalPlaces(3),
			associatedScoreAlgs: ["starRating"],
		},
	},

	defaultScoreRatingAlg: "rating",
	defaultSessionRatingAlg: "naiveRating",
	defaultProfileRatingAlg: "naiveRating",

	difficulties: {
		type: "FIXED",
		order: ["BASIC", "ADVANCED", "EXPERT", "MASTER", "Re:MASTER", "LUNATIC"],
		formatShort: {
			BASIC: "BAS",
			ADVANCED: "ADV",
			EXPERT: "EXP",
			MASTER: "MAS",
			"Re:MASTER": "Re:MAS",
			LUNATIC: "LUN",
		},
		formatLong: {},
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
		maxPlatScore: z.number().int().nonnegative(),
		inGameID: z.number().int().nonnegative().nullable(),
		chartViewURL: z.string().optional(),
	}),

	preferences: z.strictObject({}),

	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["songTitle", "tachiSongID", "inGameID"],
} as const satisfies INTERNAL_GAME_CONFIG;
