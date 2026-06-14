import type { Database } from "tachi-db";

import { getCronTaskDefinitions } from "#lib/jobs/cron/cron-registry";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { CronExpressionParser } from "cron-parser";
import { type Kysely, sql } from "kysely";

/** Namespaces `pg_try_advisory_lock` for the cron scheduler. */
const CRON_ADVISORY_KEY1 = 0x54_61_63_68; // "Tach"
const CRON_ADVISORY_KEY2 = 0x63_72_6f_6e; // "cron"

/**
 * Next cron fire strictly after `last`, that is still <= `now`.
 * If none, `null` (not due). "Skip missed" to the latest such fire time.
 *
 * When `last` is null (never scheduled), walking forward from the epoch is infeasible for
 * minutely schedules. We first find a recent `start` by exponential lookback where the first
 * `next()` is still <= `now`, then advance with the same `next()` loop as the non-null path.
 */
export function getDueFireTime(schedule: string, last: Date | null, now: Date): Date | null {
	const startAndFirstAfter = (
		start: Date,
	): { first: Date; it: ReturnType<typeof CronExpressionParser.parse> } => {
		const it = CronExpressionParser.parse(schedule, { currentDate: start });
		const first = it.next().toDate();
		return { it, first };
	};

	let it: ReturnType<typeof CronExpressionParser.parse>;
	let first: Date;

	if (!last) {
		let windowMs = 60_000;
		const maxWindowMs = 800 * 24 * 60 * 60 * 1000;
		while (true) {
			const start = new Date(Math.max(0, now.getTime() - windowMs));
			const parsed = startAndFirstAfter(start);
			if (parsed.first.getTime() <= now.getTime()) {
				it = parsed.it;
				first = parsed.first;
				break;
			}
			if (windowMs >= maxWindowMs) {
				return null;
			}
			windowMs = Math.min(windowMs * 2, maxWindowMs);
		}
	} else {
		const parsed = startAndFirstAfter(new Date(last.getTime() + 1));
		it = parsed.it;
		first = parsed.first;
	}

	if (first.getTime() > now.getTime()) {
		return null;
	}
	let lastDue = first;
	const maxSteps = 2_000_000;
	for (let step = 0; step < maxSteps; step++) {
		const n = it.next().toDate();
		if (n.getTime() > now.getTime()) {
			return lastDue;
		}
		lastDue = n;
	}
	throw new Error(`getDueFireTime exceeded ${maxSteps} next() steps (schedule ${schedule}).`);
}

export async function syncCronTasksFromRegistry(executor: Kysely<Database> = DB): Promise<void> {
	const defs = getCronTaskDefinitions();
	const now = new Date().toISOString();
	for (const d of defs) {
		await executor
			.insertInto("cron_task")
			.values({
				id: d.id,
				schedule: d.schedule,
				description: d.description,
				created_at: now,
				updated_at: now,
				last_scheduled_at: null,
			})
			.onConflict((oc) =>
				oc.column("id").doUpdateSet({
					schedule: d.schedule,
					description: d.description,
					updated_at: now,
				}),
			)
			.execute();
	}
}

/**
 * Session advisory locks must be released on the same backend that acquired them. The global
 * pool used by `DB` would otherwise acquire on connection A and `pg_advisory_unlock` on B,
 * leaving the lock held until A disconnects — then every `pg_try_advisory_lock` fails and
 * `runCronTickOnce` no-ops with no INFO-level log.
 */
export async function runCronTickOnce(): Promise<void> {
	await DB.connection().execute(async (conn) => {
		const r = await sql<{ acquired: boolean }>`
			SELECT pg_try_advisory_lock(${CRON_ADVISORY_KEY1}, ${CRON_ADVISORY_KEY2}) AS acquired
		`.execute(conn);
		const got = (r.rows[0] as { acquired: boolean } | undefined)?.acquired === true;
		if (!got) {
			log.debug(
				"Cron tick skipped: advisory lock not acquired (another worker or stale session lock).",
			);
			return;
		}
		try {
			await syncCronTasksFromRegistry(conn);
			const now = new Date();
			const rows = await DB.selectFrom("cron_task")
				.select(["cron_task.id", "cron_task.schedule", "cron_task.last_scheduled_at"])
				.execute();
			const byId = new Map(rows.map((r) => [r.id, r]));
			for (const def of getCronTaskDefinitions()) {
				const row = byId.get(def.id);
				if (!row) {
					continue;
				}
				const last = row.last_scheduled_at ? new Date(row.last_scheduled_at) : null;
				const due = getDueFireTime(def.schedule, last, now);
				if (!due) {
					continue;
				}
				const scheduledAtIso = due.toISOString();
				const execRow = await DB.insertInto("cron_task_execution")
					.values({
						task_id: def.id,
						scheduled_at: scheduledAtIso,
						status: "running",
						completed_at: null,
						output: null,
						error: null,
					})
					.returning("cron_task_execution.id")
					.executeTakeFirstOrThrow();

				try {
					await def.run();
					await DB.updateTable("cron_task")
						.set({
							last_scheduled_at: scheduledAtIso,
							updated_at: new Date().toISOString(),
						})
						.where("cron_task.id", "=", def.id)
						.execute();
					await DB.updateTable("cron_task_execution")
						.set({
							status: "success",
							completed_at: new Date().toISOString(),
							output: null,
							error: null,
						})
						.where("cron_task_execution.id", "=", execRow.id)
						.execute();
					(def.quiet ? log.debug : log.info)(
						`Cron task ${def.id} completed for fire ${scheduledAtIso}.`,
					);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					log.error({ err }, `Cron task ${def.id} failed.`);
					await DB.updateTable("cron_task")
						.set({
							last_scheduled_at: scheduledAtIso,
							updated_at: new Date().toISOString(),
						})
						.where("cron_task.id", "=", def.id)
						.execute();
					await DB.updateTable("cron_task_execution")
						.set({
							status: "failure",
							completed_at: new Date().toISOString(),
							error: message,
						})
						.where("cron_task_execution.id", "=", execRow.id)
						.execute();
				}
			}
		} finally {
			await sql`
				SELECT pg_advisory_unlock(${CRON_ADVISORY_KEY1}, ${CRON_ADVISORY_KEY2})
			`.execute(conn);
		}
	});
}
