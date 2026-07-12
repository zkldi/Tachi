import type { KtLogger } from "#lib/log/log";
import type { integer } from "tachi-common";

import { GetImportTimestop } from "#lib/score-import/framework/common/timestop";
import { ParseKaiIIDX } from "#lib/score-import/import-types/common/api-kai/iidx/parser";
import { GetKaiAuthGuaranteed } from "#utils/queries/auth";

export async function ParseEagIIDX(userID: integer, log: KtLogger) {
	const [authDoc, lastScoreTime] = await Promise.all([
		GetKaiAuthGuaranteed(userID, "EAG", log),
		GetImportTimestop(userID, "api/eag-iidx"),
	]);

	return ParseKaiIIDX("EAG", authDoc, log, undefined, null, lastScoreTime);
}
