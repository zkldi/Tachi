import type { KtLogger } from "#lib/log/log";
import type { BatchManualContext } from "#lib/score-import/import-types/common/batch-manual/types";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { BatchManualScore, V3Game } from "tachi-common";

import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ParseBatchManualFromObject } from "#lib/score-import/import-types/common/batch-manual/parser";

/**
 * Parses a buffer of BATCH-MANUAL data.
 * @param fileData - The buffer to parse.
 * @param body - The request body that made this file import request.
 */
function ParseBatchManual(
	fileData: Express.Multer.File,
	body: Record<string, unknown>,
	log: KtLogger,
): ParserFunctionReturns<BatchManualScore, BatchManualContext, V3Game> {
	let jsonData: unknown;

	try {
		jsonData = JSON.parse(fileData.buffer.toString("utf-8"));
	} catch (err) {
		throw new ScoreImportFatalError(400, `Invalid JSON. (${(err as Error).message})`);
	}

	return ParseBatchManualFromObject(jsonData, "file/batch-manual", false, log);
}

export default ParseBatchManual;
