import { FetchCGScores } from "./traverse-api";
import { CGGameToTachiGame } from "./util";
import db from "external/mongo/db";
import ScoreImportFatalError from "lib/score-import/framework/score-importing/score-import-error";
import fetch from "node-fetch";
import { p } from "prudence";
import { FormatPrError } from "tachi-common";
import type { ParserFunctionReturns } from "../types";
import type {
	CGContext,
	CGIIDXScore,
	CGJubeatScore,
	CGMusecaScore,
	CGPopnScore,
	CGSDVXScore,
	CGServices,
	CGSupportedGames,
} from "./types";
import type { KtLogger } from "lib/logger/logger";
import type { PrudenceSchema } from "prudence";
import type { integer } from "tachi-common";

const PR_CG_JUBEAT = {
	internalId: p.isPositiveInteger,
	difficulty: p.isPositiveInteger,
	version: p.isPositiveInteger,

	// unused
	clearFlag: p.any,

	score: p.isBoundedInteger(0, 1_000_000),
	hardMode: "boolean",

	perfectCount: p.isPositiveInteger,
	greatCount: p.isPositiveInteger,
	goodCount: p.isPositiveInteger,
	poorCount: p.isPositiveInteger,
	missCount: p.isPositiveInteger,
	musicRate: p.isBoundedInteger(0, 120_0),
	dateTime: "string",
};

const PR_CG_SDVX = {
	internalId: p.isPositiveInteger,
	difficulty: p.isPositiveInteger,
	version: p.isPositiveInteger,
	score: p.isBoundedInteger(0, 10_000_000),
	exScore: p.isPositiveInteger,
	clearType: p.isPositiveInteger,

	// unused
	scoreGrade: p.any,
	maxChain: p.isPositiveInteger,
	critical: p.isPositiveInteger,
	near: p.isPositiveInteger,
	error: p.isPositiveInteger,
	dateTime: "string",
};

const PR_CG_MUSECA = {
	internalId: p.isPositiveInteger,
	difficulty: p.isPositiveInteger,
	version: p.isPositiveInteger,
	score: p.isBoundedInteger(0, 1_000_000),

	// unused
	clearType: p.any,
	scoreGrade: p.any,

	maxChain: p.isPositiveInteger,
	critical: p.isPositiveInteger,
	near: p.isPositiveInteger,
	error: p.isPositiveInteger,
	dateTime: "string",
};

const PR_CG_POPN = {
	internalId: p.isPositiveInteger,
	difficulty: p.isPositiveInteger,
	version: p.isPositiveInteger,
	clearFlag: p.isPositiveInteger,

	// edge case. Score can go above 100k in battle mode.
	// although we don't support battle mode,
	// we cannot reject this in the parser - as it will cancel the entire import.
	score: p.isPositiveInteger,

	coolCount: p.isPositiveInteger,
	greatCount: p.isPositiveInteger,
	goodCount: p.isPositiveInteger,
	badCount: p.isPositiveInteger,

	dateTime: "string",
};

const PR_CG_IIDX = {
	internalId: p.isPositiveInteger,
	difficulty: "string",
	version: p.isPositiveInteger,
	exScore: p.isPositiveInteger,
	clearType: p.isPositiveInteger,
	perfectCount: p.isPositiveInteger,
	greatCount: p.isPositiveInteger,

	// missCount is -1 when it's not recorded, so we have to allow that.
	missCount: p.or(p.isPositiveInteger, p.is(-1)),

	// unused
	dead: p.any,

	option1: p.isPositiveInteger,
	option2: p.isPositiveInteger,
	ghost: p.any,
	ghostGauge: p.any,

	dateTime: "string",
};

// given a CG game, what should the returned data look like?
const CG_SCHEMAS: Record<CGSupportedGames, PrudenceSchema> = {
	iidx: PR_CG_IIDX,
	jb: PR_CG_JUBEAT,
	msc: PR_CG_MUSECA,
	popn: PR_CG_POPN,
	sdvx: PR_CG_SDVX,
};

/**
 * Create a CG parser for this supported game. Since all CG parsing code is effectively
 * identical, this basically just placeholders cgGame and service.
 */
export function CreateCGParser<T>(cgGame: CGSupportedGames, service: CGServices) {
	return async (
		userID: integer,
		logger: KtLogger
	): Promise<ParserFunctionReturns<T, CGContext>> => {
		const cardInfo = await db["cg-card-info"].findOne({
			userID,
			service,
		});

		if (!cardInfo) {
			throw new ScoreImportFatalError(
				401,
				`This user has no card info set up for this service.`
			);
		}

		const scores = await FetchCGScores(service, cardInfo, cgGame, logger, fetch);

		const SCHEMA = CG_SCHEMAS[cgGame];

		// check that this data is in the structure we expected
		const err = p({ data: scores }, { data: [SCHEMA] });

		if (err) {
			throw new ScoreImportFatalError(400, FormatPrError(err, `Invalid CG ${cgGame} Score.`));
		}

		return {
			context: {
				service,
				userID: cardInfo.userID,
			},
			game: CGGameToTachiGame(cgGame),
			iterable: scores as Array<T>,
			classProvider: null,
		};
	};
}

export const ParseCGDevMuseca = CreateCGParser<CGMusecaScore>("msc", "dev");
export const ParseCGDevSDVX = CreateCGParser<CGSDVXScore>("sdvx", "dev");
export const ParseCGDevJubeat = CreateCGParser<CGJubeatScore>("jb", "dev");
export const ParseCGDevPopn = CreateCGParser<CGPopnScore>("popn", "dev");
export const ParseCGDevIIDX = CreateCGParser<CGIIDXScore>("iidx", "dev");

export const ParseCGGanMuseca = CreateCGParser<CGMusecaScore>("msc", "gan");
export const ParseCGGanSDVX = CreateCGParser<CGSDVXScore>("sdvx", "gan");
export const ParseCGGanJubeat = CreateCGParser<CGJubeatScore>("jb", "gan");
export const ParseCGGanPopn = CreateCGParser<CGPopnScore>("popn", "gan");
export const ParseCGGanIIDX = CreateCGParser<CGIIDXScore>("iidx", "gan");

export const ParseCGNagMuseca = CreateCGParser<CGMusecaScore>("msc", "nag");
export const ParseCGNagSDVX = CreateCGParser<CGSDVXScore>("sdvx", "nag");
export const ParseCGNagJubeat = CreateCGParser<CGJubeatScore>("jb", "nag");
export const ParseCGNagPopn = CreateCGParser<CGPopnScore>("popn", "nag");
export const ParseCGNagIIDX = CreateCGParser<CGIIDXScore>("iidx", "nag");
