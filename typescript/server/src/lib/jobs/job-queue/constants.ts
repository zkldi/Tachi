/** Canonical `job_queue.job_kind` for score import jobs. */
export const JOB_KIND_SCORE_IMPORT = "score_import" as const;

/** Matches client adminConstants and Zenith `job_queue.status` values. */
export const JOB_STATUS_QUEUED = 0;
export const JOB_STATUS_RUNNING = 1;
export const JOB_STATUS_DONE = 2;
export const JOB_STATUS_FAILED = 3;

/**
 * Exponential-backoff retry settings for score-import jobs that hit a 409 "ongoing import"
 * while running on the Postgres job queue.
 *
 * Formula: delayMs = min(MAX_DELAY_MS, BASE_MS * 2 ** failedAttempts) ± 10% jitter
 * A job is given up after `failed_attempts` reaches MAX_RETRIES (i.e. after MAX_RETRIES
 * unsuccessful 409 attempts).
 */
export const SCORE_IMPORT_409_RETRY_BASE_MS = 250;
export const SCORE_IMPORT_409_RETRY_MAX_DELAY_MS = 60_000;
export const SCORE_IMPORT_409_MAX_RETRIES = 20;

/**
 * Compute the millisecond delay for the next retry attempt given the current
 * `failed_attempts` count (before incrementing). Applies ±10% jitter.
 */
export function computeBackoffDelayMs(failedAttempts: number): number {
	const base = Math.min(
		SCORE_IMPORT_409_RETRY_MAX_DELAY_MS,
		SCORE_IMPORT_409_RETRY_BASE_MS * 2 ** failedAttempts,
	);
	const jitter = base * 0.1 * (2 * Math.random() - 1);
	return Math.round(base + jitter);
}
