import type { ScoreImportJob, ScoreImportProgress } from "#lib/score-import/worker/types";

import { PublishImportProgressEvent } from "#lib/jobs/job-queue/worker-pubsub";

/**
 * Throttle interval for per-score `updateProgress` calls. Stage-level
 * transitions (parsing, sessions, PBs, etc.) are emitted immediately via
 * `SetJobProgress` in score-import-main.ts, so the throttle only applies
 * to the high-frequency per-score loop.
 */
const PROGRESS_THROTTLE_MS = 500;

/**
 * `ScoreImportJob` implementation that publishes progress to the per-import
 * Redis pub/sub channel so connected SSE clients receive live updates.
 *
 * Per-score `updateProgress` calls are throttled to at most one publish per
 * {@link PROGRESS_THROTTLE_MS} ms to avoid flooding Redis on large imports.
 * The throttle is bypassed for stage-level messages (see {@link forcePublish}).
 */
export class RedisScoreImportJob implements ScoreImportJob {
	private lastPublishMs = 0;

	constructor(private readonly importID: string) {}

	/**
	 * Publish a stage-level progress message immediately, bypassing the throttle.
	 * Use this for meaningful pipeline transitions (parsing, sessions, PBs, etc.)
	 * where the message should always reach connected clients.
	 */
	forcePublish(description: string): void {
		this.lastPublishMs = Date.now();
		PublishImportProgressEvent(this.importID, { type: "progress", description });
	}

	updateProgress({ description }: ScoreImportProgress): void {
		const now = Date.now();
		if (now - this.lastPublishMs >= PROGRESS_THROTTLE_MS) {
			this.lastPublishMs = now;
			PublishImportProgressEvent(this.importID, { type: "progress", description });
		}
	}
}
