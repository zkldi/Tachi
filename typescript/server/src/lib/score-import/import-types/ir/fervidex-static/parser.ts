import type { KtLogger } from "#lib/log/log";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup } from "tachi-common";

import { AssertStrAsPositiveInt } from "#lib/score-import/framework/common/string-asserts";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { IsRecord } from "#utils/misc";
import { FormatPrError } from "#utils/prudence";
import { p, type PrudenceSchema } from "prudence";

import type { FervidexStaticContext, FervidexStaticHeaders, FervidexStaticScore } from "./types";

import { SoftwareIDToVersion } from "../fervidex/parser";
import { CreateFerStaticClassProvider } from "./class-handler";

const PR_FERVIDEX_STATIC: PrudenceSchema = {
	ex_score: p.isPositiveInteger,
	miss_count: p.optional(p.nullable(p.or(p.isPositiveInteger, p.is(-1)))),
	clear_type: p.isBoundedInteger(0, 7),
};

export function ParseFervidexStatic(
	body: Record<string, unknown>,
	headers: FervidexStaticHeaders,
	log: KtLogger,
): ParserFunctionReturns<FervidexStaticScore, FervidexStaticContext, GamesForGroup["iidx"]> {
	const version = SoftwareIDToVersion(headers.model, log);
	const classProvider = CreateFerStaticClassProvider(body);

	// if we shouldn't import scores, just sync up dans.
	if (!headers.shouldImportScores) {
		return {
			service: "Fervidex Static",
			context: { version },
			gameGroup: "iidx",
			iterable: [],
			classProvider,
		};
	}

	const staticScores = body.scores;

	if (!IsRecord(staticScores)) {
		throw new ScoreImportFatalError(400, `Invalid body.scores.`);
	}

	const scores: Array<FervidexStaticScore> = [];

	for (const [songID, subScores] of Object.entries(staticScores)) {
		const intSongID = AssertStrAsPositiveInt(songID, `Invalid songID ${songID}.`);

		if (!IsRecord(subScores)) {
			throw new ScoreImportFatalError(400, `Invalid score with songID ${songID}.`);
		}

		for (const [chart, score] of Object.entries(subScores)) {
			if (!IsRecord(score)) {
				throw new ScoreImportFatalError(
					400,
					`Invalid score with songID ${songID} at chart ${chart}.`,
				);
			}

			if (!["dpa", "dph", "dpl", "dpn", "spa", "spb", "sph", "spl", "spn"].includes(chart)) {
				throw new ScoreImportFatalError(400, `Invalid chart ${chart}.`);
			}

			const err = p(score, PR_FERVIDEX_STATIC);

			if (err) {
				throw new ScoreImportFatalError(
					400,
					FormatPrError(err, `Invalid Score with songID ${songID} at chart ${chart}`),
				);
			}

			// is asserted by prudence.
			const sc = score as unknown as FervidexStaticScore;

			scores.push({
				song_id: intSongID,

				// is asserted with the above "spb"... check
				chart: chart as FervidexStaticScore["chart"],
				clear_type: sc.clear_type,
				ex_score: sc.ex_score,
				miss_count: sc.miss_count === undefined ? null : sc.miss_count,
			});
		}
	}

	// asserted using prudence.
	return {
		service: "Fervidex Static",
		context: { version },
		gameGroup: "iidx",
		iterable: scores,
		classProvider,
	};
}
