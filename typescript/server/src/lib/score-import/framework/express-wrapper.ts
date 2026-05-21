import type { ParserArguments } from "#lib/score-import/worker/types";
import type {
	ImportDocument,
	ImportTypes,
	integer,
	SuccessfulAPIResponse,
	UnsuccessfulAPIResponse,
} from "tachi-common";

import { log } from "#lib/log/log";
import { AwaitScoreImportWorkerResult } from "#lib/score-import/worker/await-worker-result";
import { EnqueueScoreImportJob } from "#lib/score-import/worker/enqueue-pg";
import { RunScoreImportOnce } from "#lib/score-import/worker/run-score-import";
import { ServerConfig } from "#lib/setup/config";
import { Random20Hex } from "#utils/misc";

import ScoreImportFatalError from "./score-importing/score-import-error";

export interface WrappedAPIResponse {
	statusCode: number;
	body: SuccessfulAPIResponse<ImportDocument> | UnsuccessfulAPIResponse;
}

/**
 * Runs a score import and converts the result into a {@link WrappedAPIResponse}
 * suitable for `res.json()`.
 *
 * In normal operation this enqueues to the Postgres job queue and polls until the
 * worker finishes (up to {@link AwaitScoreImportWorkerResult}'s deadline).
 *
 * When `ServerConfig.INLINE_SCORE_IMPORT` is true (test environments only, where
 * no job-queue worker is running) the import runs inline via {@link RunScoreImportOnce}
 * so tests exercise the full import code path without needing a live worker process.
 */
export async function ExpressWrappedScoreImportMain<I extends ImportTypes>(
	userID: integer,
	userIntent: boolean,
	importType: I,
	parserArguments: ParserArguments<I>,
): Promise<WrappedAPIResponse> {
	const importID = Random20Hex();

	log.debug("Received import request.");

	try {
		const jobData = {
			importID,
			importType,
			userIntent,
			userID,
			parserArguments,
		};

		let res: ImportDocument;

		if (ServerConfig.INLINE_SCORE_IMPORT) {
			// Test-only inline path: runs the full import logic without the job queue.
			const result = await RunScoreImportOnce(jobData);

			switch (result.kind) {
				case "done":
					res = result.importDoc;
					break;
				case "lock_held":
					return {
						statusCode: 409,
						body: {
							success: false,
							description: "This user already has an ongoing import.",
						},
					};
				case "expected_err":
					return {
						statusCode: result.statusCode,
						body: { success: false, description: result.description },
					};
			}
		} else {
			await EnqueueScoreImportJob(jobData);
			res = await AwaitScoreImportWorkerResult(importID);
		}

		return {
			statusCode: 200,
			body: {
				success: true,
				description: "Import successful.",
				body: res,
			},
		};
	} catch (err) {
		// `AwaitScoreImportWorkerResult` throws `ScoreImportFatalError` when the
		// worker records a failed import.
		if (err instanceof ScoreImportFatalError) {
			log.info(err.message);
			return {
				statusCode: err.statusCode,
				body: { success: false, description: err.message },
			};
		}

		log.error(err);
		return {
			statusCode: 500,
			body: {
				success: false,
				description: "An internal service error has occurred. This has been reported!",
			},
		};
	}
}
