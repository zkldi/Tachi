import type { ImportDocument } from "tachi-common";

import {
	GetImportTrackerByImportId,
	LoadImportDocumentById,
} from "#lib/db-formats/import-document";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { Sleep } from "#utils/misc";

const POLL_MS = 100;
const MAX_WAIT_MS = 600_000;

/**
 * After {@link EnqueueScoreImportJob}, blocks until the worker finishes the import
 * and a completed {@link ImportDocument} is available, the tracker records failure,
 * or the wait times out.
 *
 * Used by {@link ExpressWrappedScoreImportMain} so IR and similar callers keep
 * synchronous response semantics while processing still runs on the job-queue worker.
 */
export async function AwaitScoreImportWorkerResult(importID: string): Promise<ImportDocument> {
	const deadline = Date.now() + MAX_WAIT_MS;

	while (Date.now() < deadline) {
		const doc = await LoadImportDocumentById(importID);
		if (doc) {
			return doc;
		}

		const tracker = await GetImportTrackerByImportId(importID);
		if (tracker?.type === "FAILED") {
			const code = tracker.error.statusCode ?? 500;
			throw new ScoreImportFatalError(code, tracker.error.message);
		}

		await Sleep(POLL_MS);
	}

	throw new ScoreImportFatalError(
		504,
		"Score import timed out waiting for the import worker to finish.",
	);
}
