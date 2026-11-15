import type { KtLogger } from "#lib/log/log";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { IsRecord } from "#utils/misc";
import { FormatPrError } from "#utils/prudence";
import { p } from "prudence";
import {
	type BatchManual,
	type BatchManualScore,
	GameToGameGroup,
	type ImportTypes,
	type V3Game,
} from "tachi-common";
import { PR_BATCH_MANUAL } from "tachi-common/lib/schemas";

import type { ParserFunctionReturns } from "../types";
import type { BatchManualContext } from "./types";

import { CreateBatchManualClassProvider } from "./class-handler";
import { ResolveBatchManualGame } from "./common";

/**
 * Parses an object of BATCH-MANUAL data.
 * @param object - The object to parse.
 * @param body - The request body that made this file import request.
 */
export function ParseBatchManualFromObject(
	object: unknown,
	importType: ImportTypes,
	inferTimestamp: boolean,
	_log: KtLogger,
): ParserFunctionReturns<BatchManualScore, BatchManualContext, V3Game> {
	// now to perform some basic validation so we can return
	// the iterable

	if (!IsRecord(object)) {
		throw new ScoreImportFatalError(
			400,
			`Invalid BATCH-MANUAL (Not an object, received ${
				object === null ? "null" : typeof object
			}.)`,
		);
	}

	// attempt to retrieve game
	// @ts-expect-error man.
	const maybeGame = object.meta?.game as unknown;
	if (maybeGame === undefined) {
		throw new ScoreImportFatalError(
			400,
			`Could not retrieve meta.game - is this valid BATCH-MANUAL?`,
		);
	}

	if (typeof maybeGame !== "string") {
		throw new ScoreImportFatalError(
			400,
			`Invalid meta.game, expected a string - is this valid BATCH-MANUAL?`,
		);
	}

	// @ts-expect-error man.
	const maybePlaytype = object.meta?.playtype as unknown;

	if (maybePlaytype !== undefined && typeof maybePlaytype !== "string") {
		throw new ScoreImportFatalError(
			400,
			`Do not provide 'playtype'. This is legacy code and barely supported.`,
		);
	}

	const game = ResolveBatchManualGame(maybeGame, maybePlaytype);

	// now that we have the game, we can validate this against
	// the prudence schema for batch-manual.
	// This mostly works as a sanity check, and doesn't
	// check things like whether a score is > 100%
	// or something.
	const err = p(object, PR_BATCH_MANUAL(game));

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid BATCH-MANUAL"));
	}

	const batchManual = object as unknown as BatchManual;

	// If this import method wants us to infer the timestamp then we should do that
	// this operation only really makes sense for single-score imports so
	// we'll enforce that.
	if (inferTimestamp) {
		if (batchManual.scores.length > 1) {
			throw new ScoreImportFatalError(
				400,
				`Cannot use X-Infer-Score-TimeAchieved with multiple scores in your import.`,
			);
		}

		if (batchManual.scores[0]!.timeAchieved) {
			throw new ScoreImportFatalError(
				400,
				`Cannot use X-Infer-Score-Timestamp if the importing score already has a timeAchieved set.`,
			);
		}

		batchManual.scores[0]!.timeAchieved = Date.now();
	}

	let service = batchManual.meta.service;

	if (importType === "ir/direct-manual") {
		service = `${service} (DIRECT-MANUAL)`;
	} else if (importType === "file/batch-manual") {
		service = `${service} (BATCH-MANUAL)`;
	}

	return {
		service,
		gameGroup: GameToGameGroup(game),
		context: {
			service: batchManual.meta.service,
			game,
			version: batchManual.meta.version ?? null,
		},
		iterable: batchManual.scores,

		// if classes are provided, use those as a class handler. Otherwise, we
		// don't care.
		classProvider: batchManual.classes
			? CreateBatchManualClassProvider(game, batchManual.classes)
			: null,
	};
}
