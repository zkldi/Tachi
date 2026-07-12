import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError } from "#utils/prudence";
import { p, type PrudenceSchema } from "prudence";

import type { KsHookSV6CContext, KsHookSV6CScore } from "./types";

export const PR_KSHOOK_SV6C: PrudenceSchema = {
	clear: p.isIn(
		"CLEAR_PLAYED",
		"CLEAR_EFFECTIVE",
		"CLEAR_EXCESSIVE",
		"CLEAR_ULTIMATE_CHAIN",
		"CLEAR_MAXXIVE",
		"CLEAR_PERFECT",
	),
	difficulty: p.isIn(
		"DIFFICULTY_NOVICE",
		"DIFFICULTY_ADVANCED",
		"DIFFICULTY_EXHAUST",
		"DIFFICULTY_INFINITE",
		"DIFFICULTY_MAXIMUM",
	),
	gauge: p.isBetween(0, 10000),
	grade: p.isIn(
		"GRADE_D",
		"GRADE_C",
		"GRADE_B",
		"GRADE_A",
		"GRADE_A_PLUS",
		"GRADE_AA",
		"GRADE_AA_PLUS",
		"GRADE_AAA",
		"GRADE_AAA_PLUS",
		"GRADE_S",
	),
	max_chain: p.isPositiveInteger,
	music_id: p.isPositiveInteger,

	score: p.isBoundedInteger(0, 10_000_000),
	ex_score: p.isPositiveInteger,

	critical: p.isPositiveInteger,
	near: p.isPositiveInteger,
	error: p.isPositiveInteger,

	rate: p.isIn(
		"RATE_EFFECTIVE",
		"RATE_PERMISSIVE",
		"RATE_EXCESSIVE",
		"RATE_BLASTIVE",
		"RATE_MAXXIVE",
	),

	track_no: p.isPositiveInteger,
	retry_count: p.any,
};

export function ParseKsHookSV6C(
	body: Record<string, unknown>,
	_log: KtLogger,
): ParserFunctionReturns<KsHookSV6CScore, KsHookSV6CContext, GamesForGroup["sdvx"]> {
	// Ignore excess keys, as SV6C might add more features in the future.
	const err = p(body, PR_KSHOOK_SV6C, undefined, { allowExcessKeys: true });

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err));
	}

	const score = body as unknown as KsHookSV6CScore;

	return {
		service: "kshook SV6C",
		gameGroup: "sdvx",
		iterable: [score],
		context: {
			timeReceived: Date.now(),
		},
		classProvider: null,
	};
}
