import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { GamesForGroup } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError } from "#utils/prudence";
import { p, type PrudenceSchema } from "prudence";

import type { KsHookSV6CStaticBody, KsHookSV6CStaticScore } from "./types";

import { PR_KSHOOK_SV6C } from "../kshook-sv6c/parser";

const PR_KSHOOK_SV6C_STATIC: PrudenceSchema = {
	scores: [
		{
			score: PR_KSHOOK_SV6C.score!,
			ex_score: PR_KSHOOK_SV6C.ex_score!,
			clear: PR_KSHOOK_SV6C.clear!,
			difficulty: PR_KSHOOK_SV6C.difficulty!,
			grade: PR_KSHOOK_SV6C.grade!,
			max_chain: PR_KSHOOK_SV6C.max_chain!,
			music_id: PR_KSHOOK_SV6C.music_id!,

			timestamp: p.isPositiveInteger,
		},
	],
};

export function ParseKsHookSV6CStatic(
	body: Record<string, unknown>,
	_log: KtLogger,
): ParserFunctionReturns<KsHookSV6CStaticScore, EmptyObject, GamesForGroup["sdvx"]> {
	// Ignore excess keys, as SV6C might add more features in the future.
	const err = p(body, PR_KSHOOK_SV6C_STATIC, undefined, { allowExcessKeys: true });

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err));
	}

	const data = body as unknown as KsHookSV6CStaticBody;

	return {
		service: "kshook SV6C Static",
		gameGroup: "sdvx",
		iterable: data.scores,
		context: {},
		classProvider: null,
	};
}
