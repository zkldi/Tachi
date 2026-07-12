import type { KtLogger } from "#lib/log/log";
import type {
	IIDXEamusementCSVContext,
	IIDXEamusementCSVData,
} from "#lib/score-import/import-types/common/eamusement-iidx-csv/types";
import type { ParserFunctionReturns } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup } from "tachi-common";

import GenericParseEamIIDXCSV from "#lib/score-import/import-types/common/eamusement-iidx-csv/parser";

function ParsePLIIIDXCSV(
	fileData: Express.Multer.File,
	body: Record<string, unknown>,
	log: KtLogger,
): ParserFunctionReturns<IIDXEamusementCSVData, IIDXEamusementCSVContext, GamesForGroup["iidx"]> {
	return GenericParseEamIIDXCSV(fileData, body, "PLI", log);
}

export default ParsePLIIIDXCSV;
