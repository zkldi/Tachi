import type { KtLogger } from "#lib/log/log";

import { SELECT_CG_CARD_INFO, ToCGCardInfo } from "#lib/db-formats/cg-card-info";
import { GetImportTimestop } from "#lib/score-import/framework/common/timestop";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import DB from "#services/pg/db";
import fetch from "node-fetch";
import { p, type PrudenceSchema } from "prudence";
import { type APIImportTypes, FormatPrError, type integer, type V3Game } from "tachi-common";

import type { ParserFunctionReturns } from "../types";
import type {
	CGContext,
	CGJubeatScore,
	CGMusecaScore,
	CGPopnScore,
	CGSDVXScore,
	CGServices,
	CGSupportedGames,
} from "./types";

import { FetchCGScores } from "./traverse-api";
import { CGGameToTachiGame, FormatCGService } from "./util";

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

// given a CG game, what should the returned data look like?
const CG_SCHEMAS: Record<CGSupportedGames, PrudenceSchema> = {
	jb: PR_CG_JUBEAT,
	msc: PR_CG_MUSECA,
	sdvx: PR_CG_SDVX,
	popn: PR_CG_POPN,
};

/**
 * Create a CG parser for this supported game. Since all CG parsing code is effectively
 * identical, this basically just placeholders cgGame and service.
 */
export function CreateCGParser<T extends { dateTime: string }>(
	cgGame: CGSupportedGames,
	service: CGServices,
	importType: APIImportTypes,
) {
	return async (
		userID: integer,
		log: KtLogger,
	): Promise<ParserFunctionReturns<T, CGContext, V3Game>> => {
		const [row, lastScoreTime] = await Promise.all([
			DB.selectFrom("priv_svc_cg_card_info")
				.select(SELECT_CG_CARD_INFO)
				.where("priv_svc_cg_card_info.user_id", "=", userID)
				.where("priv_svc_cg_card_info.service", "=", service)
				.executeTakeFirst(),
			GetImportTimestop(userID, importType),
		]);

		const cardInfo = row ? ToCGCardInfo(row) : undefined;

		if (!cardInfo) {
			throw new ScoreImportFatalError(
				401,
				`This user has no card info set up for this service.`,
			);
		}

		const scores = await FetchCGScores(service, cardInfo, cgGame, log, fetch);

		const SCHEMA = CG_SCHEMAS[cgGame];

		// check that this data is in the structure we expected
		const err = p({ data: scores }, { data: [SCHEMA] });

		if (err) {
			throw new ScoreImportFatalError(400, FormatPrError(err, `Invalid CG ${cgGame} Score.`));
		}

		const cutoff = lastScoreTime?.getTime() ?? null;

		const filtered =
			cutoff === null
				? (scores as Array<T>)
				: (scores as Array<T>).filter((s) => {
						const parsed = Date.parse(s.dateTime);

						return Number.isNaN(parsed) || parsed > cutoff;
					});

		return {
			service: FormatCGService(service),
			context: {
				service,
				userID: cardInfo.userID,
			},
			gameGroup: CGGameToTachiGame(cgGame),
			iterable: filtered,
			classProvider: null,
		};
	};
}

export const ParseCGDevMuseca = CreateCGParser<CGMusecaScore>("msc", "dev", "api/cg-dev-museca");
export const ParseCGDevSDVX = CreateCGParser<CGSDVXScore>("sdvx", "dev", "api/cg-dev-sdvx");
export const ParseCGDevJubeat = CreateCGParser<CGJubeatScore>("jb", "dev", "api/cg-dev-jubeat");
export const ParseCGDevPopn = CreateCGParser<CGPopnScore>("popn", "dev", "api/cg-dev-popn");

export const ParseCGGanMuseca = CreateCGParser<CGMusecaScore>("msc", "gan", "api/cg-gan-museca");
export const ParseCGGanSDVX = CreateCGParser<CGSDVXScore>("sdvx", "gan", "api/cg-gan-sdvx");
export const ParseCGGanJubeat = CreateCGParser<CGJubeatScore>("jb", "gan", "api/cg-gan-jubeat");
export const ParseCGGanPopn = CreateCGParser<CGPopnScore>("popn", "gan", "api/cg-gan-popn");

export const ParseCGNagMuseca = CreateCGParser<CGMusecaScore>("msc", "nag", "api/cg-nag-museca");
export const ParseCGNagSDVX = CreateCGParser<CGSDVXScore>("sdvx", "nag", "api/cg-nag-sdvx");
export const ParseCGNagJubeat = CreateCGParser<CGJubeatScore>("jb", "nag", "api/cg-nag-jubeat");
export const ParseCGNagPopn = CreateCGParser<CGPopnScore>("popn", "nag", "api/cg-nag-popn");
