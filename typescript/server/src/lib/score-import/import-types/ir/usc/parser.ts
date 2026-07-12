import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { USCClientScore } from "#server/router/ir/usc/_playtype/types";
import type { GamesForGroup, LEGACY_Playtypes } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError } from "#utils/prudence";
import { p, type PrudenceSchema } from "prudence";

import type { IRUSCContext } from "./types";

const PR_USCIR_SCORE: PrudenceSchema = {
	score: p.isBoundedInteger(0, 10_000_000),
	gauge: p.isBetween(0, 1),
	timestamp: p.isPositiveInteger,
	crit: p.isPositiveInteger,
	near: p.isPositiveInteger,
	error: p.isPositiveInteger,
	early: p.optional(p.isPositiveInteger),
	late: p.optional(p.isPositiveInteger),
	combo: p.optional(p.isPositiveInteger),
	options: {
		gaugeType: p.isIn(0, 1, 2),
		mirror: "boolean",
		random: "boolean",
		autoFlags: p.isInteger,
	},
	windows: {
		perfect: p.isPositive,
		good: p.isPositive,
		hold: p.isPositive,
		miss: p.isPositive,
		slam: p.isPositive,
	},
};

export function ParseIRUSC(
	body: Record<string, unknown>,
	chartHash: string,
	playtype: LEGACY_Playtypes["usc"],
	_log: KtLogger,
): ParserFunctionReturns<USCClientScore, IRUSCContext, GamesForGroup["usc"]> {
	const err = p(
		body.score,
		PR_USCIR_SCORE,
		{},
		{ throwOnNonObject: false, allowExcessKeys: true },
	);

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid USC Score."));
	}

	const score = body.score as USCClientScore;

	// Enforce null for this instead of undefined.
	// This is because FJSH cannot handle undefined properly.
	// Maybe fjsh should handle that, lol...
	score.early ??= null;
	score.late ??= null;
	score.combo ??= null;

	return {
		service: "USC-IR",
		context: {
			chartHash,
			playtype,
			timeReceived: Date.now(),
		},
		gameGroup: "usc",
		iterable: [score] as Array<USCClientScore>,
		classProvider: null,
	};
}
