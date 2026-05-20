import type { Action, CronTask, CronTaskExecution, JobQueue } from "tachi-db";

import { ONE_HOUR } from "#lib/constants/time";
import {
	SELECT_CRON_TASK,
	SELECT_CRON_TASK_EXECUTION,
	SELECT_JOB_QUEUE,
} from "#lib/db-formats/admin-jobs";
import DB from "#services/pg/db";

export const ADMIN_PAGE_SIZE = 50;

/** Only list job queue rows and actions from this many hours ago (inclusive). */
export const ADMIN_RECENT_HOURS = 12;

export function adminRecentSinceIso(hours = ADMIN_RECENT_HOURS): string {
	return new Date(Date.now() - ONE_HOUR * hours).toISOString();
}

export interface JobQueueFilters {
	job_kind?: string;
	scope?: string;
	status?: number;
}

export interface PaginatedResult<T> {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
}

/** Currently running jobs (not limited by the recent-hours window). */
export function GetActiveJobs(limit = ADMIN_PAGE_SIZE): Promise<Array<JobQueue>> {
	return DB.selectFrom("job_queue")
		.select(SELECT_JOB_QUEUE)
		.where("job_queue.status", "=", 1)
		.orderBy("job_queue.scheduled_for", "asc")
		.limit(limit)
		.execute();
}

function jobQueueBaseQuery(filters: JobQueueFilters) {
	let q = DB.selectFrom("job_queue").where("job_queue.created_at", ">=", adminRecentSinceIso());
	if (filters.status !== undefined) {
		q = q.where("job_queue.status", "=", filters.status);
	}
	if (filters.job_kind) {
		q = q.where("job_queue.job_kind", "=", filters.job_kind);
	}
	if (filters.scope) {
		q = q.where("job_queue.scope", "=", filters.scope);
	}
	return q;
}

export async function GetJobQueue({
	page = 0,
	limit = ADMIN_PAGE_SIZE,
	status,
	job_kind,
	scope,
}: { limit?: number; page?: number } & JobQueueFilters): Promise<PaginatedResult<JobQueue>> {
	const filters: JobQueueFilters = { job_kind, scope, status };
	const base = jobQueueBaseQuery(filters);

	const [items, countRow] = await Promise.all([
		base
			.select(SELECT_JOB_QUEUE)
			.orderBy("job_queue.created_at", "desc")
			.limit(limit)
			.offset(page * limit)
			.execute(),
		jobQueueBaseQuery(filters)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
	]);

	return {
		items,
		page,
		pageSize: limit,
		total: Number(countRow.count),
	};
}

export interface ActionFilters {
	kind?: string;
	username?: string;
}

export type ActionRow = { username: string | null } & Action;

function actionFilteredQuery(filters: ActionFilters) {
	let q = DB.selectFrom("action")
		.leftJoin("account", "account.id", "action.user_id")
		.where("action.ts_start", ">=", adminRecentSinceIso());
	if (filters.kind) {
		q = q.where("action.kind", "=", filters.kind);
	}
	if (filters.username) {
		q = q.where("account.username", "ilike", `%${filters.username}%`);
	}
	return q;
}

export async function GetActions({
	page = 0,
	limit = ADMIN_PAGE_SIZE,
	kind,
	username,
}: { limit?: number; page?: number } & ActionFilters): Promise<PaginatedResult<ActionRow>> {
	const filters: ActionFilters = { kind, username };
	const base = actionFilteredQuery(filters);

	const [items, countRow] = await Promise.all([
		base
			.select([
				"action.row_id",
				"action.user_id",
				"action.ip",
				"action.app",
				"action.kind",
				"action.result",
				"action.input",
				"action.output",
				"action.ts_start",
				"action.ts_end",
				"account.username",
			])
			.orderBy("action.ts_start", "desc")
			.limit(limit)
			.offset(page * limit)
			.execute(),
		actionFilteredQuery(filters)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
	]);

	return {
		items,
		page,
		pageSize: limit,
		total: Number(countRow.count),
	};
}

export function GetCronTasks(): Promise<Array<CronTask>> {
	return DB.selectFrom("cron_task")
		.select(SELECT_CRON_TASK)
		.orderBy("cron_task.id", "asc")
		.execute();
}

export function GetCronTaskExecutions(limit = 100): Promise<Array<CronTaskExecution>> {
	return DB.selectFrom("cron_task_execution")
		.select(SELECT_CRON_TASK_EXECUTION)
		.orderBy("cron_task_execution.scheduled_at", "desc")
		.limit(limit)
		.execute();
}
