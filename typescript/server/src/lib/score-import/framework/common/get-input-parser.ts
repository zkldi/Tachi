import type { KtLogger } from "#lib/log/log";
import type {
	ImportTypeContextMap,
	ImportTypeDataMap,
	ParserFunctionReturns,
} from "#lib/score-import/import-types/common/types";
import type { ScoreImportJobData } from "#lib/score-import/worker/types";
import type { ImportTypes, V3Game } from "tachi-common";

import { Parsers } from "#lib/score-import/import-types/parsers";

export function GetInputParser<I extends ImportTypes>(jobData: ScoreImportJobData<I>) {
	// Retrieve the set parser function for this import type.
	const ParserFunction = Parsers[jobData.importType];

	const InputParser = (log: KtLogger) =>
		// @ts-expect-error TypeScript doesn't like the fact that we
		// pass this as a rest parameter, since none of the parsers
		// actually take rest args. However, this is the only way to
		// achieve the dynamic passing we need to, so lets just override
		// it here.
		ParserFunction(...jobData.parserArguments, log) as Promise<
			ParserFunctionReturns<ImportTypeDataMap[I], ImportTypeContextMap[I], V3Game>
		>;

	return InputParser;
}
