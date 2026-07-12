import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { BMSGames, integer } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { FormatPrError } from "#utils/prudence";
import { p } from "prudence";

import type { BeatorajaChart, BeatorajaContext, BeatorajaScore } from "./types";

const PR_BEATORAJA_SCORE = {
	// sha256 **MUST** be a 64 char hex string.
	sha256: p.regex(/^[0-9a-f]{64}$/u),

	exscore: p.isPositiveInteger,
	passnotes: p.isPositiveInteger,
	gauge: p.or(p.isBetween(0, 100), p.is(-1)),
	deviceType: p.isIn("BM_CONTROLLER", "KEYBOARD", "MIDI"),
	minbp: p.or(p.isPositiveInteger, p.is(-1)),
	option: p.isInteger,

	lntype: p.isIn(0, 1),
	clear: p.isIn(
		"NoPlay",
		"Failed",
		"AssistEasy",
		"LightAssistEasy",
		"Easy",
		"Normal",
		"Hard",
		"ExHard",
		"FullCombo",
		"Perfect",
		"Max",
	),
	assist: p.is(0),
	maxcombo: p.isPositiveInteger,

	epg: p.isPositiveInteger,
	egr: p.isPositiveInteger,
	egd: p.isPositiveInteger,
	ebd: p.isPositiveInteger,
	epr: p.isPositiveInteger,
	lpg: p.isPositiveInteger,
	lgr: p.isPositiveInteger,
	lgd: p.isPositiveInteger,
	lbd: p.isPositiveInteger,
	lpr: p.isPositiveInteger,
	ems: p.isPositiveInteger,
	lms: p.isPositiveInteger,
};

const PR_BEATORAJA_CHART = {
	// IMPORTANT!!! MD5 IS **NOT GUARANTEED TO BE CORRECT AT ALL.
	// IT IS PERFECTLY LEGAL FOR RAJA TO GIVE YOU **ANYTHING** IN THIS FIELD.
	// YOU SHOULD ONLY USE IT IF YOU CHECK IT AND IT LOOKS LIKE A VALID MD5.
	// THIS MAY BE THE EMPTY STRING, THE STRING "null", etc.
	md5: "string",

	// sha256 **MUST** be a 64 char hex string.
	sha256: p.regex(/^[0-9a-f]{64}$/u),

	title: "string",
	subtitle: "string",
	genre: "string",
	artist: "string",
	subartist: "string",
	total: p.isPositive,
	lntype: p.isIn(-1, 0, 1, 2),

	// currently only accepted playtypes.
	mode: p.isIn("BEAT_7K", "BEAT_14K", "POPN_9K"),
	judge: p.isPositive,
	notes: p.isPositiveInteger,
	hasUndefinedLN: "boolean",
	hasRandom: "boolean",
};

export function ParseBeatorajaSingle(
	body: Record<string, unknown>,
	userID: integer,
	_log: KtLogger,
): ParserFunctionReturns<BeatorajaScore, BeatorajaContext, BMSGames> {
	const err = p(
		body.score,
		PR_BEATORAJA_SCORE,
		{},
		{ allowExcessKeys: true, throwOnNonObject: false },
	);

	if (err) {
		throw new ScoreImportFatalError(
			400,
			FormatPrError(err, "Invalid Beatoraja Import - Score"),
		);
	}

	const chartErr = p(
		body.chart,
		PR_BEATORAJA_CHART,
		{},
		{ allowExcessKeys: true, throwOnNonObject: false },
	);

	if (chartErr) {
		throw new ScoreImportFatalError(
			400,
			FormatPrError(chartErr, "Invalid Beatoraja Import - Chart"),
		);
	}

	// Force stringify this, since it's not validated by prudence.
	const client = `${body.client}`;

	const score = body.score as BeatorajaScore;
	const chart = body.chart as BeatorajaChart;

	const isPMS = chart.mode === "POPN_9K";

	const expectedClient = isPMS ? "beatoraja" : "LR2oraja";

	if (!client.startsWith(expectedClient)) {
		throw new ScoreImportFatalError(
			400,
			`Unsupported client ${client} -- Expected a variant of ${expectedClient}.`,
		);
	}

	return {
		service: "Beatoraja IR",
		context: {
			client: isPMS ? "beatoraja" : "lr2oraja",

			// asserted using prudence.
			chart,
			userID,
			timeReceived: Date.now(),
		},
		gameGroup: isPMS ? "pms" : "bms",
		iterable: [score],
		classProvider: null,
	};
}
