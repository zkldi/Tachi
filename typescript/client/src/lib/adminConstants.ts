/** Matches Postgres job_queue.status values (Zenith-style). */
export const JOB_STATUS: Record<number, string> = {
	0: "Queued",
	1: "Running",
	2: "Done",
	3: "Failed",
};

/** Matches server `ADMIN_PAGE_SIZE` in admin-queries.ts */
export const ADMIN_PAGE_SIZE = 50;

/** Matches server `ADMIN_RECENT_HOURS` in admin-queries.ts */
export const ADMIN_RECENT_HOURS = 12;
