import type { KtLogger } from "#lib/log/log";
import type { BatchManualContext } from "#lib/score-import/import-types/common/batch-manual/types";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { BatchManualScore, V3Game } from "tachi-common";

import { ParseBatchManualFromObject } from "#lib/score-import/import-types/common/batch-manual/parser";

/**
 * Parses an object of BATCH-MANUAL data.
 * @param fileData - The buffer to parse.
 * @param body - The request body that made this file import request.
 */
function ParseDirectManual(
	body: Record<string, unknown>,
	inferTimestamp: boolean,
	log: KtLogger,
): ParserFunctionReturns<BatchManualScore, BatchManualContext, V3Game> {
	return ParseBatchManualFromObject(body, "ir/direct-manual", inferTimestamp, log);
}

export default ParseDirectManual;
