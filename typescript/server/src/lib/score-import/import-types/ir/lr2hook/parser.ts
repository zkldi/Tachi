import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError, optNull } from "#utils/prudence";
import { p, type PrudenceSchema } from "prudence";

import type { LR2HookContext, LR2HookScore } from "./types";

const SUPPORTED_RANDOMS = ["NORAN", "MIRROR", "RAN", "S-RAN"];

const checkHpGraph = (self: unknown) => {
	if (!Array.isArray(self)) {
		return "Expected an array";
	}

	if (self.length !== 1000) {
		return "Expected an array with length 1000.";
	}

	if (self.some((x) => x < 0 || x > 100 || !Number.isInteger(x))) {
		return "Expected an array of 1000 integers between 0 and 100.";
	}

	return true;
};

export const PR_LR2HOOK: PrudenceSchema = {
	md5: "string",
	playerData: {
		autoScr: p.is(0),

		// don't really need this, but it's
		// { "ALL", "SINGLE", "7K", "5K", "DOUBLE", "14K", "10K", "9K" };
		gameMode: p.any,

		// ALLSCR and H-RAN may also be sent, but we don't support them.
		random: p.isIn(SUPPORTED_RANDOMS),
		gauge: p.isIn("GROOVE", "HARD", "HAZARD", "EASY", "P-ATTACK", "G-ATTACK"),
		rseed: p.optional(p.isBoundedInteger(0, 0x7ffe)),
	},
	scoreData: {
		pgreat: p.isPositiveInteger,
		great: p.isPositiveInteger,
		good: p.isPositiveInteger,
		bad: p.isPositiveInteger,
		poor: p.isPositiveInteger,
		maxCombo: p.isPositiveInteger,
		exScore: p.isPositiveInteger,
		moneyScore: p.isPositiveInteger,
		notesTotal: p.isPositiveInteger,
		notesPlayed: p.isPositiveInteger,
		lamp: p.isIn("NO PLAY", "FAIL", "EASY", "NORMAL", "HARD", "FULL COMBO"),
		hpGraph: checkHpGraph,
		extendedJudgements: optNull({
			epg: p.isPositiveInteger,
			lpg: p.isPositiveInteger,
			egr: p.isPositiveInteger,
			lgr: p.isPositiveInteger,
			egd: p.isPositiveInteger,
			lgd: p.isPositiveInteger,
			ebd: p.isPositiveInteger,
			lbd: p.isPositiveInteger,
			epr: p.isPositiveInteger,
			lpr: p.isPositiveInteger,
			cb: p.isPositiveInteger,
			fast: p.isPositiveInteger,
			slow: p.isPositiveInteger,
			notesPlayed: p.isPositiveInteger,
		}),
		extendedHpGraphs: optNull({
			groove: checkHpGraph,
			hard: checkHpGraph,
			hazard: checkHpGraph,
			easy: checkHpGraph,
			pattack: checkHpGraph,
			gattack: checkHpGraph,
		}),
	},
	unixTimestamp: p.optional(p.isPositiveInteger),
};

export function ParseLR2Hook(
	body: Record<string, unknown>,
	_log: KtLogger,
): ParserFunctionReturns<LR2HookScore, LR2HookContext, GamesForGroup["bms"]> {
	// Ignore excess keys, as lr2hook is likely to add more features in the future.
	const err = p(
		body,
		PR_LR2HOOK,
		{
			playerData: {
				autoScr:
					"Auto Scratch cannot be turned on, as it is treated as an EASY CLEAR by LR2.",
				random: `Expected any of ${SUPPORTED_RANDOMS.join(
					", ",
				)}. Note that ALLSCR and H-RAN are not supported!`,
			},
		},
		{ allowExcessKeys: true },
	);

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err));
	}

	const score = body as unknown as LR2HookScore;

	return {
		service: "LR2Hook",
		gameGroup: "bms",
		iterable: [score],
		context: {
			timeReceived: Date.now(),
		},
		classProvider: null,
	};
}
