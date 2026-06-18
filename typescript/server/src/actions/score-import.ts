import type { ScoreImportJobData } from "#lib/score-import/worker/types";

import { MakeAction } from "#lib/actions/actions";
import { PublishImportProgressEvent } from "#lib/jobs/job-queue/worker-pubsub";
import { GetInputParser } from "#lib/score-import/framework/common/get-input-parser";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import ScoreImportMain from "#lib/score-import/framework/score-importing/score-import-main";
import {
	EndTrackingImport,
	MarkImportAsFailed,
	StartTrackingImport,
} from "#lib/score-import/framework/status-tracking/import-status-tracking";
import { RedisScoreImportJob } from "#lib/score-import/worker/redis-score-import-job";
import { ExpectedErr } from "bliss";
import { type ImportTypes } from "tachi-common";

/**
 * Authoritative score-import mutation: tracking (unless worker already did), parse + convert,
 * `EndTrackingImport` or `MarkImportAsFailed`, and `action` table audit. User-facing
 * `ScoreImportFatalError` is turned into `ExpectedErr` for correct audit (`BAD` / not `THROW`).
 *
 * The caller ({@link RunScoreImportOnce}) is responsible for acquiring and releasing the
 * per-user import lock *before* invoking this action. `ScoreImportMain` will throw an
 * `InternalFailure` if the lock is not held when it is called.
 */
export const ACTION_ScoreImport = MakeAction("SCORE_IMPORT", async (taker, input) => {
	const { importID, importType, userIntent, skipStartTracking } = input;
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

	const job = new RedisScoreImportJob(importID);

	try {
		const InputParser = GetInputParser(jobData);
		await ScoreImportMain(
			taker.acct.id,
			userIntent,
			importType as ImportTypes,
			InputParser,
			importID,
			undefined,
			job,
		);
		await EndTrackingImport(importID);
		PublishImportProgressEvent(importID, { type: "done" });
		return { importID };
	} catch (e) {
		const err = e as Error | ScoreImportFatalError;
		await MarkImportAsFailed(importID, err);
		PublishImportProgressEvent(importID, {
			type: "import:failed",
			description: err.message,
		});
		if (err instanceof ScoreImportFatalError) {
			throw new ExpectedErr(err.statusCode, err.message);
		}
		throw e;
	}
});
