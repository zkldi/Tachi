import { log } from "#lib/log/log";
import { RedisClient } from "#services/redis/redis";

export const JOB_QUEUE_EVENTS_CHANNEL = "job-queue:events";

/**
 * Redis key written by the worker process on startup so the HTTP process
 * (and therefore the SSE stream) knows how many worker slots exist.
 */
export const WORKER_COUNT_REDIS_KEY = "job-queue:worker-count";

export type WorkerPubSubEvent =
	| {
			durationMs: number;
			jobId: string;
			success: boolean;
			type: "job:done";
	  }
	| {
			importId: string;
			importType: string;
			jobId: string;
			type: "job:start";
			userId: number;
	  }
	| { type: "job:enqueued" };

/**
 * Publish a job lifecycle event to the Redis pub/sub channel. Fire-and-forget;
 * errors are logged but never thrown so callers are never disrupted.
 */
export function PublishJobEvent(event: WorkerPubSubEvent): void {
	RedisClient.publish(JOB_QUEUE_EVENTS_CHANNEL, JSON.stringify(event)).catch((err: unknown) => {
		log.warn({ err, event }, "Failed to publish job event to Redis.");
	});
}

// ── Per-import progress pub/sub ───────────────────────────────────────────────

/** Per-import Redis pub/sub channel name. */
export function importProgressChannel(importID: string): string {
	return `import-progress:${importID}`;
}

export type ImportProgressEvent =
	| { description: string; type: "import:failed" }
	| { description: string; type: "progress" }
	| { type: "done" };

/**
 * Publish a progress event on the per-import channel. Fire-and-forget.
 */
export function PublishImportProgressEvent(importID: string, event: ImportProgressEvent): void {
	RedisClient.publish(importProgressChannel(importID), JSON.stringify(event)).catch(
		(err: unknown) => {
			log.warn({ err, importID, event }, "Failed to publish import progress event to Redis.");
		},
	);
}
