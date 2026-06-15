/**
 * Common stuff for that all games might want to inherit.
 */

import { p } from "prudence";

import type { ConfScoreMetric } from "../../types/metrics";

import { FmtNum } from "../../utils/util";

/**
 * A lot of games have a concept of timing windows and "missing". This means that
 * fast/slow and maxCombo are a given for almost every rhythm game.
 *
 * @note Additional metrics are *OPTIONAL!*. Your game might not implement fast/slow
 * or maxCombo, but if they conceptually have the idea of fast/slow or maxCombo, the
 * metrics should exist anyway. Why not. it's nice.
 *
 * There are a couple edge cases where this might not apply. For example, if a game has
 * no timing windows, it can't really have a concept of "fast" or "slow".
 *
 * I can't think of a realistic case where a game might not have a concept of "maxCombo"
 * as that necessitates that you either can't miss, or can't hit.
 */
export const FAST_SLOW_MAXCOMBO = {
	fast: {
		type: "INTEGER",
		validate: p.isPositiveInteger,
		formatter: FmtNum,
		goalTitleFormatter: (v) => `Get ${v} fasts in`,
		goalOutOfFormatter: FmtNum,
		description: "The amount of mistakes in this score that were a result of hitting early.",
	},
	slow: {
		type: "INTEGER",
		validate: p.isPositiveInteger,
		formatter: FmtNum,
		goalTitleFormatter: (v) => `Get ${v} slows in`,
		goalOutOfFormatter: FmtNum,
		description: "The amount of mistakes in this score that were a result of hitting late.",
	},
	maxCombo: {
		type: "INTEGER",
		validate: p.isPositiveInteger,
		formatter: FmtNum,
		goalTitleFormatter: (v) => `Get a max combo of ${v} in`,
		goalOutOfFormatter: FmtNum,
		description: "The largest combo in this score.",
	},
} as const satisfies Record<string, ConfScoreMetric>;
