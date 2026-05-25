import type { KtLogger } from "#lib/log/log";
import type { integer } from "tachi-common";

import { GetImportTimestop } from "#lib/score-import/framework/common/timestop";
import { ParseKaiSDVX } from "#lib/score-import/import-types/common/api-kai/sdvx/parser";
import { GetKaiAuthGuaranteed } from "#utils/queries/auth";

export async function ParseEagSDVX(userID: integer, log: KtLogger) {
	const [authDoc, lastScoreTime] = await Promise.all([
		GetKaiAuthGuaranteed(userID, "EAG", log),
		GetImportTimestop(userID, "api/eag-sdvx"),
	]);

	return ParseKaiSDVX("EAG", authDoc, log, undefined, null, lastScoreTime);
}
