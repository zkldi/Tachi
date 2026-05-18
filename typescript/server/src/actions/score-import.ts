import type { ScoreImportJobData } from "#lib/score-import/worker/types";

import { MakeAction } from "#lib/actions/actions";
import { GetInputParser } from "#lib/score-import/framework/common/get-input-parser";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import ScoreImportMain from "#lib/score-import/framework/score-importing/score-import-main";
import {
	EndTrackingImport,
	MarkImportAsFailed,
	StartTrackingImport,
} from "#lib/score-import/framework/status-tracking/import-status-tracking";
import { ExpectedErr } from "bliss";
import { type ImportTypes } from "tachi-common";

/**
 * Authoritative score-import mutation: tracking (unless worker already did), parse + convert,
 * `EndTrackingImport` or `MarkImportAsFailed`, and `action` table audit. User-facing
 * `ScoreImportFatalError` is turned into `ExpectedErr` for correct audit (`BAD` / not `THROW`).
 */
export const ACTION_ScoreImport = MakeAction("SCORE_IMPORT", async (taker, input) => {
	const { importID, importType, userIntent, skipStartTracking, omitImportTrackerFailureOn409 } =
		input;
	const parserArguments = input[
		"!parserArguments"
	] as ScoreImportJobData<ImportTypes>["parserArguments"];

	const jobData: ScoreImportJobData<ImportTypes> = {
		importID,
		importType: importType as ImportTypes,
		userID: taker.acct.id,
		userIntent,
		parserArguments,
	};

	if (!skipStartTracking) {
		await StartTrackingImport(jobData);
	}

	try {
		const InputParser = GetInputParser(jobData);
		await ScoreImportMain(
			taker.acct.id,
			userIntent,
			importType as ImportTypes,
			InputParser,
			importID,
		);
		await EndTrackingImport(importID);
		return { importID };
	} catch (e) {
		const err = e as Error | ScoreImportFatalError;
		const is409 = err instanceof ScoreImportFatalError && err.statusCode === 409;
		if (!is409 || !omitImportTrackerFailureOn409) {
			await MarkImportAsFailed(importID, err);
		}
		if (err instanceof ScoreImportFatalError) {
			throw new ExpectedErr(err.statusCode, err.message);
		}
		throw e;
	}
});
