import type { JobQueue, NewJobQueue } from "tachi-db";

type EnqueueInput = Omit<NewJobQueue, "failed_attempts" | "status">;
import {
	JOB_STATUS_DONE,
	JOB_STATUS_FAILED,
	JOB_STATUS_QUEUED,
	JOB_STATUS_RUNNING,
} from "#lib/jobs/job-queue/constants";
import DB from "#services/pg/db";
import { sql } from "kysely";

/**
 * Enqueue a job (queued, due on or before `scheduled_for`).
 */
export async function EnqueueJob(row: EnqueueInput): Promise<string> {
	const r = await DB.insertInto("job_queue")
		.values({
			...row,
			status: JOB_STATUS_QUEUED,
			failed_attempts: 0,
		})
		.returning("job_queue.row_id")
		.executeTakeFirstOrThrow();
	return r.row_id;
}

/**
 * Claim the next job using `FOR UPDATE SKIP LOCKED` (fair multi-worker).
 */
export async function ClaimNextJob(): Promise<JobQueue | undefined> {
	const r = await sql<JobQueue>`
		WITH picked AS (
			SELECT "job_queue"."row_id"
			FROM "job_queue"
			WHERE "job_queue"."status" = ${JOB_STATUS_QUEUED}
				AND "job_queue"."scheduled_for" <= NOW()
			ORDER BY "job_queue"."scheduled_for" ASC, "job_queue"."created_at" ASC
			FOR UPDATE OF "job_queue" SKIP LOCKED
			LIMIT 1
		)
		UPDATE "job_queue"
		SET
			"status" = ${JOB_STATUS_RUNNING},
			"updated_at" = NOW()
		FROM picked
		WHERE "job_queue"."row_id" = "picked"."row_id"
		RETURNING
			"job_queue"."row_id",
			"job_queue"."created_at",
			"job_queue"."updated_at",
			"job_queue"."scheduled_for",
			"job_queue"."failed_attempts",
			"job_queue"."status",
			"job_queue"."scope",
			"job_queue"."job_kind",
			"job_queue"."payload"
	`.execute(DB);

	if (r.rows.length === 0) {
		return undefined;
	}
	return r.rows[0] as unknown as JobQueue;
}

export async function MarkJobDone(rowId: string): Promise<void> {
	await DB.updateTable("job_queue")
		.set({ status: JOB_STATUS_DONE, updated_at: new Date().toISOString() })
		.where("job_queue.row_id", "=", rowId)
		.execute();
}

export async function MarkJobFailed(rowId: string): Promise<void> {
	await DB.updateTable("job_queue")
		.set({ status: JOB_STATUS_FAILED, updated_at: new Date().toISOString() })
		.where("job_queue.row_id", "=", rowId)
		.execute();
}

/**
 * Requeue a currently-running job for a 409-retry attempt.
 * Resets status to QUEUED, advances `scheduled_for` by the computed backoff delay,
 * and increments `failed_attempts`.
 */
export async function RequeueJobAfter409Attempt(
	rowId: string,
	currentFailedAttempts: number,
	scheduledForIso: string,
): Promise<void> {
	await DB.updateTable("job_queue")
		.set({
			status: JOB_STATUS_QUEUED,
			scheduled_for: scheduledForIso,
			failed_attempts: currentFailedAttempts + 1,
			updated_at: new Date().toISOString(),
		})
		.where("job_queue.row_id", "=", rowId)
		.where("job_queue.status", "=", JOB_STATUS_RUNNING)
		.execute();
}
