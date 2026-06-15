import { p } from "prudence";
import { z } from "zod";

import type { INTERNAL_GAME_CONFIG, INTERNAL_GAME_GROUP_CONFIG } from "../../types/internals";

import { FmtNum } from "../../utils/util";
import { NoDecimalPlace, zodNonNegativeInt } from "../config-utils";
import { FAST_SLOW_MAXCOMBO } from "./_common";

export const GAME_GROUP_MUSECA_CONF = {
	name: "MÚSECA",
	dynamicContent: false,
	games: ["museca"],
	playtypes: ["Single"],
	songData: z.strictObject({
		titleJP: z.string(),
		artistJP: z.string(),
		displayVersion: z.string(),
	}),
} as const satisfies INTERNAL_GAME_GROUP_CONFIG;

export const GAME_MUSECA_CONF = {
	providedMetrics: {
		score: {
			type: "INTEGER",
			validate: p.isBetween(0, 1_000_000),
			formatter: FmtNum,
			goalTitleFormatter: (v) => `Get a score of ${v.toLocaleString("en-GB")} on`,
			goalOutOfFormatter: (v) => v.toLocaleString("en-GB"),
			description: "The score value. This is between 0 and 1 million.",
		},
		lamp: {
			type: "ENUM",
			values: ["FAILED", "CLEAR", "CONNECT ALL", "PERFECT CONNECT ALL"],
			minimumRelevantValue: "CLEAR",
			description:
				"The type of clear this score was. **Note:** we define a CLEAR as being >= 800k, and FAILED as anything less. We do not respect MUSECA's story mode for clear/failed types.",
		},
	},

	derivedMetrics: {
		grade: {
			type: "ENUM",

			// MUSECA uses kanji for its grades. This is kinda inconvenient to read.
			// Ah well!
			values: ["没", "拙", "凡", "佳", "良", "優", "秀", "傑", "傑G"],

			// This is equal to 900K.
			// In my opinion (zk) this is a little too low for this
			// game, as 900K is pretty easy to get. Ah well!
			minimumRelevantValue: "優",

			description: "The grade this score was.",
		},
	},

	defaultMetric: "score",
	preferredDefaultEnum: "grade",

	optionalMetrics: FAST_SLOW_MAXCOMBO,

	scoreRatingAlgs: {
		curatorSkill: {
			description: "Curator Skill as it's implemented in-game.",
			formatter: NoDecimalPlace,
		},
	},
	sessionRatingAlgs: {
		curatorSkill: {
			description: "The average of your best 10 Curator skills this session.",
			formatter: NoDecimalPlace,
		},
	},
	profileRatingAlgs: {
		curatorSkill: {
			description:
				"The sum of your best 20 Curator Skills. This is identical to how it's calculated in-game.",
			formatter: NoDecimalPlace,
			associatedScoreAlgs: ["curatorSkill"],
		},
	},

	defaultScoreRatingAlg: "curatorSkill",
	defaultSessionRatingAlg: "curatorSkill",
	defaultProfileRatingAlg: "curatorSkill",

	difficulties: {
		type: "FIXED",
		order: ["Green", "Yellow", "Red"],
		formatShort: { Green: "G", Yellow: "Y", Red: "R" },
		formatLong: {},
		default: "Red",
	},

	classes: {},

	orderedJudgements: ["critical", "near", "miss"],

	/* eslint-disable quote-props */
	versions: {
		"1.5": "1 + 1/2",
		"1.5-b": "1 + 1/2 Rev. B",
	},
	/* eslint-enable quote-props */

	chartData: z.strictObject({ inGameID: zodNonNegativeInt }),

	preferences: z.strictObject({}),

	scoreMeta: z.strictObject({}),

	supportedMatchTypes: ["songTitle", "tachiSongID", "inGameID"],
} as const satisfies INTERNAL_GAME_CONFIG;
