import { FAST_SLOW_MAXCOMBO } from "./_common";
import { FmtNum, FmtPercent } from "../../utils/util";
import { ClassValue, zodNonNegativeInt } from "../config-utils";
import { p } from "prudence";
import { z } from "zod";
import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_PT_CONFIG } from "../../types/internals";

export const JUBEAT_CONF = {
	name: "jubeat",
	playtypes: ["Single"],
	songData: z.strictObject({
		displayVersion: z.string(),
	}),
} as const satisfies INTERNAL_GAME_CONFIG;

const JubeatColours = [
	ClassValue("BLACK", "Black"),
	ClassValue("YELLOW_GREEN", "Yellow-Green"),
	ClassValue("GREEN", "Green"),
	ClassValue("LIGHT_BLUE", "Light Blue"),
	ClassValue("BLUE", "Blue"),
	ClassValue("VIOLET", "Violet"),
	ClassValue("PURPLE", "Purple"),
	ClassValue("PINK", "Pink"),
	ClassValue("ORANGE", "Orange"),
	ClassValue("GOLD", "Gold"),
];

export const JUBEAT_SINGLE_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_000_000),
			formatter: FmtNum,
			description: "The score value. This is between 0 and 1 million.",
		},
		musicRate: {
			type: "DECIMAL",
			chartDependentMax: true,
			formatter: FmtPercent,
			description:
				"The music rate for this score. This is between 0 and 100 on normal difficulties, and 0 and 120 for hard-mode difficulties. This should be submitted to one decimal place.",
		},
		lamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "FULL COMBO", "EXCELLENT"],
			minimumRelevantValue: "CLEAR",
			description: "The type of clear this was.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",
			values: ["E", "D", "C", "B", "A", "S", "SS", "SSS", "EXC"],
			minimumRelevantValue: "A",
			description: "The grade this score was.",
		},
	},

	defaultMetric: "musicRate",
	preferredDefaultEnum: "grade",

	optionalMetrics: {
		...FAST_SLOW_MAXCOMBO,

		musicBar: {
			type: "GRAPH",
			validate: p.isBoundedInteger(0, 3),
			description: "A snapshot of how well the player did in each part of the song",
		},
	},

	scoreRatingAlgs: { jubility: { description: "Jubility as it's implemented in game." } },
	sessionRatingAlgs: {
		jubility: { description: "The average of your best 10 jubilities this session." },
	},
	profileRatingAlgs: {
		jubility: {
			description:
				"Your profile jubility. This takes your best 30 scores on PICK UP songs, and your best 30 elsewhere.",
			associatedScoreAlgs: ["jubility"],
		},
		naiveJubility: {
			description:
				"A naive version of jubility which just adds together your best 60 scores.",
			associatedScoreAlgs: ["jubility"],
		},
	},

	defaultScoreRatingAlg: "jubility",
	defaultSessionRatingAlg: "jubility",
	defaultProfileRatingAlg: "jubility",

	difficulties: {
		type: "FIXED",
		order: ["BSC", "ADV", "EXT", "HARD BSC", "HARD ADV", "HARD EXT"],
		shorthand: {
			BSC: "BSC",
			ADV: "ADV",
			EXT: "EXT",
			"HARD BSC": "H. BSC",
			"HARD ADV": "H. ADV",
			"HARD EXT": "H. EXT",
		},
		default: "EXT",
	},

	classes: {
		colour: { type: "DERIVED", values: JubeatColours, minimumScores: 60 },
	},

	orderedJudgements: ["perfect", "great", "good", "poor", "miss"],

	versions: {
		jubeat: "jubeat",
		ripples: "ripples",
		knit: "knit",
		copious: "copious",
		saucer: "saucer",
		prop: "prop",
		qubell: "Qubell",
		clan: "clan",
		festo: "festo",
		"festo-omni": "festo Omnimix",
		ave: "Ave.",
		beyond: "beyond the Ave.",
	},

	chartData: z.strictObject({
		inGameID: z.union([z.array(zodNonNegativeInt), zodNonNegativeInt]),
		noteCount: z.number().nonnegative(),
		musicBar: z.array(z.number().nonnegative()),
	}),

	preferences: z.strictObject({ jubilityTarget: z.number().optional().nullable() }),

	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["inGameID", "tachiSongID"],
} as const satisfies INTERNAL_GAME_PT_CONFIG;
