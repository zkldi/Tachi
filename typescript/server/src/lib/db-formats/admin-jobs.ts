/** Column lists for admin dashboard job / cron queries. */

export const SELECT_JOB_QUEUE = [
	"job_queue.row_id",
	"job_queue.created_at",
	"job_queue.updated_at",
	"job_queue.scheduled_for",
	"job_queue.failed_attempts",
	"job_queue.status",
	"job_queue.scope",
	"job_queue.job_kind",
	"job_queue.payload",
] as const;

export const SELECT_CRON_TASK = [
	"cron_task.id",
	"cron_task.schedule",
	"cron_task.description",
	"cron_task.created_at",
	"cron_task.updated_at",
	"cron_task.last_scheduled_at",
] as const;

export const SELECT_CRON_TASK_EXECUTION = [
	"cron_task_execution.id",
	"cron_task_execution.task_id",
	"cron_task_execution.scheduled_at",
	"cron_task_execution.started_at",
	"cron_task_execution.completed_at",
	"cron_task_execution.status",
	"cron_task_execution.output",
	"cron_task_execution.error",
] as const;
