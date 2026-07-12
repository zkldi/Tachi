import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError } from "#utils/prudence";
import { p } from "prudence";

import type { BarbatosContext, BarbatosScore, BarbatosSDVX6Score } from "./types";

const PR_BARBATOS = {
	difficulty: p.isIn(0, 1, 2, 3, 4),
	level: p.isBoundedInteger(1, 20),
	song_id: p.isPositiveInteger,
	max_chain: p.isPositiveInteger,
	critical: p.isPositiveInteger,
	near_total: p.isPositiveInteger,
	near_fast: p.isPositiveInteger,
	near_slow: p.isPositiveInteger,
	score: p.isBoundedInteger(0, 10_000_000),
	error: p.isPositiveInteger,
	percent: p.isBetween(0, 100),
	did_fail: "boolean",
	clear_type: p.isIn(1, 2, 3, 4, 5),
	gauge_type: p.isIn(0, 1, 2, 3),
	is_skill_analyzer: "boolean",
};

const PR_BARBATOS_SDVX6 = {
	difficulty: p.isIn(0, 1, 2, 3, 4),
	level: p.isBoundedInteger(1, 20),
	score: p.isBoundedInteger(0, 10_000_000),
	ex_score: p.isInteger,
	clear_type: p.isIn(1, 2, 3, 4, 5),
	song_id: p.isPositiveInteger,
	grade: p.any,
	percent: p.isBetween(0, 100),
	max_chain: p.isPositiveInteger,

	// this is a bit much lmao.
	early_error: p.isInteger,
	early_near: p.isInteger,
	early_crit: p.isInteger,
	s_crit: p.isInteger,
	late_crit: p.isInteger,
	late_near: p.isInteger,
	late_error: p.isInteger,
	chip_s_crit: p.isInteger,
	chip_crit: p.isInteger,
	chip_near: p.isInteger,
	chip_error: p.isInteger,
	long_crit: p.isInteger,
	long_error: p.isInteger,
	vol_crit: p.isInteger,
	vol_error: p.isInteger,

	gauge_type: p.isIn(0, 1, 2, 3),
};

export function ParseBarbatosSingle(
	body: Record<string, unknown>,
	_log: KtLogger,
): ParserFunctionReturns<
	BarbatosScore | BarbatosSDVX6Score,
	BarbatosContext,
	GamesForGroup["sdvx"]
> {
	// this is an extremely sketchy way of sniffing out whether it's sdvx6 or not.
	// We could ask barbatos to send a header, but what difference does it make?
	const schema = "ex_score" in body ? PR_BARBATOS_SDVX6 : PR_BARBATOS;

	const err = p(body, schema);

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid Barbatos Request"));
	}

	return {
		service: "Barbatos",
		context: {
			timeReceived: Date.now(),
			version: "ex_score" in body ? "exceed" : "vivid",
		},
		gameGroup: "sdvx",
		iterable: [body] as unknown as Array<BarbatosScore | BarbatosSDVX6Score>,
		classProvider: null,
	};
}
