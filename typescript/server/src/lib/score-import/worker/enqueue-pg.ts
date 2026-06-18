import type { ScoreImportJobData } from "#lib/score-import/worker/types";
import type { ImportTypes } from "tachi-common";

import { JOB_KIND_SCORE_IMPORT } from "#lib/jobs/job-queue/constants";
import { EnqueueJob } from "#lib/jobs/job-queue/queue-ops";
import { PublishJobEvent } from "#lib/jobs/job-queue/worker-pubsub";
import { StartTrackingImport } from "#lib/score-import/framework/status-tracking/import-status-tracking";
import { jsonSerializeWithBuffers } from "#lib/score-import/worker/score-import-job-processor";

/**
 * Enqueue a score import on the Postgres `job_queue` and begin tracking. Returns `job_queue.row_id`.
 */
export async function EnqueueScoreImportJob(
	jobData: ScoreImportJobData<ImportTypes>,
): Promise<string> {
	await StartTrackingImport(jobData);
	const payload = jsonSerializeWithBuffers(jobData);
	const jobId = await EnqueueJob({
		scheduled_for: new Date().toISOString(),
		scope: `import:${jobData.importID}`,
		job_kind: JOB_KIND_SCORE_IMPORT,
		payload: JSON.parse(payload) as unknown,
	});
	PublishJobEvent({ type: "job:enqueued" });
	return jobId;
}
