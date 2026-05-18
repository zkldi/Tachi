/* eslint-disable no-await-in-loop */
import { loadServerEnvFile } from "#lib/setup/load-server-env";
loadServerEnvFile(process.env.NODE_ENV === "test" ? ".env.test" : ".env");

import {
	computeBackoffDelayMs,
	JOB_KIND_SCORE_IMPORT,
	SCORE_IMPORT_409_MAX_RETRIES,
} from "#lib/jobs/job-queue/constants";
import { parseJobQueueWorkerOptions } from "#lib/jobs/job-queue/parse-worker-options";
import {
	ClaimNextJob,
	MarkJobDone,
	MarkJobFailed,
	RequeueJobAfter409Attempt,
} from "#lib/jobs/job-queue/queue-ops";
import { log } from "#lib/log/log";
import { maybeStartWorkerMetricsServer } from "#lib/metrics/worker-metrics";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { MarkImportAsFailed } from "#lib/score-import/framework/status-tracking/import-status-tracking";
import { CloseScoreImportQueue } from "#lib/score-import/worker/queue";
import { processScoreImportJobFromPayload } from "#lib/score-import/worker/score-import-job-processor";
import { Env } from "#lib/setup/config";
import { ClosePgConnection } from "#services/pg/db";
import { CloseRedisConnection } from "#services/redis/redis";
import { Sleep } from "#utils/misc";
import { writeFileSync } from "fs";
import { Counter, Histogram } from "prom-client";
import { applyMigrations } from "tachi-db-migration-engine";

const HEARTBEAT_FILE = "/tmp/worker-heartbeat";

const POLL_MS = 250;

/** Seconds — mirrors SCORE_IMPORT_DURATION_BUCKETS in prometheus.ts; jobs can run sub-second to 30 min. */
const JOB_DURATION_BUCKETS = [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800];

process.on("uncaughtException", (err, origin) => {
	log.fatal({ err, origin }, "Uncaught exception, terminating.");
	log.flush(() => process.exit(1));
});

void bootstrap();

async function bootstrap() {
	await applyMigrations(Env.POSTGRES_URL, Env.MIGRATIONS_DIR);

	const { workerCount } = parseJobQueueWorkerOptions(process.argv.slice(2), process.env);
	const metrics = await maybeStartWorkerMetricsServer(process.env);

	log.info(
		{ bootInfo: true, workerCount, pgPoolMax: Env.PG_POOL_MAX },
		"tachi job-queue worker starting (Postgres job_queue).",
	);

	let jobsTotal: Counter | null = null;
	let jobDurationSeconds: Histogram | null = null;

	if (metrics) {
		jobsTotal = new Counter({
			name: "job_queue_jobs_total",
			help: "Total number of job_queue jobs completed, by kind and status.",
			labelNames: ["job_kind", "status"],
			registers: [metrics.registry],
		});
		jobDurationSeconds = new Histogram({
			name: "job_queue_job_duration_seconds",
			help: "Wall-clock duration of job_queue jobs in seconds (claim through mark-done/failed).",
			labelNames: ["job_kind"],
			buckets: JOB_DURATION_BUCKETS,
			registers: [metrics.registry],
		});
	}

	let stopping = false;
	const shutdown = () => {
		stopping = true;
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Separate from the worker loops so long-running jobs cannot stall mtime updates.
	writeFileSync(HEARTBEAT_FILE, Date.now().toString());
	const heartbeatInterval = setInterval(
		() => writeFileSync(HEARTBEAT_FILE, Date.now().toString()),
		5_000,
	);

	async function runWorkerLoop(workerId: number): Promise<void> {
		// eslint-disable-next-line no-unmodified-loop-condition
		while (!stopping) {
			const job = await ClaimNextJob();

			if (!job) {
				if (stopping) {
					break;
				}
				await Sleep(POLL_MS);
				continue;
			}

			const startMs = Date.now();

			try {
				let result:
					| Awaited<ReturnType<typeof processScoreImportJobFromPayload>>
					| undefined;

				switch (job.job_kind) {
					case JOB_KIND_SCORE_IMPORT:
						result = await processScoreImportJobFromPayload(job.payload);
						break;
					default:
						log.error(
							{ job_kind: job.job_kind, row_id: job.row_id, workerId },
							"Unknown job_kind.",
						);
						throw new Error(`Unknown job_kind ${String(job.job_kind)}`);
				}

				// Score import: handle 409 "ongoing import" with exponential-backoff retry.
				if (result && !result.success && result.statusCode === 409) {
					if (job.failed_attempts >= SCORE_IMPORT_409_MAX_RETRIES) {
						log.warn(
							{
								row_id: job.row_id,
								importID: result.importID,
								failed_attempts: job.failed_attempts,
							},
							`Import ${result.importID} hit 409 ${job.failed_attempts} times, giving up.`,
						);
						await MarkImportAsFailed(
							result.importID,
							new ScoreImportFatalError(409, result.description),
						);
						await MarkJobFailed(job.row_id);
						jobDurationSeconds?.observe(
							{ job_kind: job.job_kind },
							(Date.now() - startMs) / 1000,
						);
						jobsTotal?.inc({ job_kind: job.job_kind, status: "failure" });
					} else {
						const delayMs = computeBackoffDelayMs(job.failed_attempts);
						const scheduledFor = new Date(Date.now() + delayMs).toISOString();
						log.info(
							{
								row_id: job.row_id,
								importID: result.importID,
								failed_attempts: job.failed_attempts,
								delayMs,
							},
							`Import ${result.importID} hit 409, requeueing in ${delayMs}ms (attempt ${job.failed_attempts + 1}/${SCORE_IMPORT_409_MAX_RETRIES}).`,
						);
						await RequeueJobAfter409Attempt(
							job.row_id,
							job.failed_attempts,
							scheduledFor,
						);
					}
				} else {
					await MarkJobDone(job.row_id);
					jobDurationSeconds?.observe(
						{ job_kind: job.job_kind },
						(Date.now() - startMs) / 1000,
					);
					jobsTotal?.inc({ job_kind: job.job_kind, status: "success" });
				}
			} catch (e) {
				log.error(e, `Job ${job.row_id} (worker ${workerId}) failed.`);
				await MarkJobFailed(job.row_id);
				jobDurationSeconds?.observe(
					{ job_kind: job.job_kind },
					(Date.now() - startMs) / 1000,
				);
				jobsTotal?.inc({ job_kind: job.job_kind, status: "failure" });
			}
		}
	}

	const workerPromises = Array.from({ length: workerCount }, (_, i) => runWorkerLoop(i));
	await Promise.allSettled(workerPromises);

	clearInterval(heartbeatInterval);
	metrics?.close();
	log.info("Job worker loops stopped, closing resources.");
	await CloseScoreImportQueue();
	await CloseRedisConnection();
	await ClosePgConnection();
	process.exit(0);
}
