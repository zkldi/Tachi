import { ACTION_BacksyncBmsPmsSeeds } from "#actions/backsync-bms-pms-seeds";
import { ACTION_BMSTableSync } from "#actions/bms-table-sync";
import { ACTION_UGSSnapshot } from "#actions/ugs-snapshot";
import { ACTION_UpdateBpiData } from "#actions/update-bpi-data";
import { ACTION_UpdateDpTiers } from "#actions/update-dp-tiers";
import { UpdateAILevels } from "#lib/jobs/bms-ai-table-sync";
import { DefaultAdminUser } from "#lib/jobs/default-admin-user";
import { DeorphanScoresMain } from "#lib/jobs/deorphan-scores";
import { drainStatsQueuesInOrder } from "#lib/jobs/drain-dirty-queues";
import { RebuildFolderChartLookupJob } from "#lib/jobs/rebuild-folder-chart-lookup";
import { Env, TachiConfig } from "#lib/setup/config";
import { DedupeArr } from "#utils/misc";

/** Cron tasks that are safe to run in local dev before seeds are loaded. */
export const DEV_LOCAL_CRON_TASK_IDS = ["drain_stats_queues"] as const;

export interface CronTaskDef {
	/** `cron_task.id` primary key. */
	id: string;
	/** 5-field cron in UTC. */
	schedule: string;
	/** Shown in admin and synced to `cron_task.description`. */
	description: string;
	run: () => Promise<void>;
}

function buildList(): Array<CronTaskDef> {
	const out: Array<CronTaskDef> = [
		{
			id: "rebuild_folder_chart_lookup",
			schedule: "5 0 * * *",
			description: "Rebuild folder chart lookup",
			run: RebuildFolderChartLookupJob,
		},
		{
			id: "ugs_snapshot",
			schedule: "0 0 * * *",
			description: "Snapshot User Game Stats",
			run: async () => {
				const taker = await DefaultAdminUser.actionTaker();
				await ACTION_UGSSnapshot(taker, {});
			},
		},
		{
			id: "deorphan_scores",
			schedule: "0 1 * * *",
			description: "De-Orphan Scores",
			run: DeorphanScoresMain,
		},
		{
			id: "drain_stats_queues",
			schedule: "* * * * *", // TODO(zk): really? this is so lazy
			description:
				"Drain score_rederive, pb_dirty, session_dirty, game_profile_dirty (ordered)",
			run: drainStatsQueuesInOrder,
		},
	];

	if (TachiConfig.TYPE !== "boku") {
		out.push(
			{
				id: "update_bpi",
				schedule: "2 0 * * *",
				description: "Update BPI",
				run: async () => {
					const taker = await DefaultAdminUser.actionTaker();
					await ACTION_UpdateBpiData(taker, {});
				},
			},
			{
				id: "update_dp_tiers",
				schedule: "3 0 * * *",
				description: "Update DP Tiers",
				run: async () => {
					const taker = await DefaultAdminUser.actionTaker();
					await ACTION_UpdateDpTiers(taker, {});
				},
			},
		);
	}

	if (TachiConfig.TYPE !== "kamai") {
		out.push(
			{
				id: "update_ai_table",
				schedule: "2 0 * * *",
				description: "Update AI Table",
				run: UpdateAILevels,
			},
			{
				id: "update_bms_tables",
				schedule: "3 0 * * *",
				description: "Update Tables (BMS)",
				run: async () => {
					const taker = await DefaultAdminUser.actionTaker();
					await ACTION_BMSTableSync(taker, {});
				},
			},
			{
				id: "backsync_bms_pms",
				schedule: "4 0 * * *",
				description: "Backsync BMS + PMS",
				run: async () => {
					const taker = await DefaultAdminUser.actionTaker();
					await ACTION_BacksyncBmsPmsSeeds(taker, {});
				},
			},
		);
	}

	const names = out.map((e) => e.id);
	if (DedupeArr(names).length !== names.length) {
		throw new Error("cron task registry has duplicate id fields");
	}
	return filterCronTasksForEnvironment(out);
}

/**
 * Local dev starts the cron worker alongside the API. With `last_scheduled_at = null`, daily
 * maintenance jobs (BMS table sync, backsync, etc.) backfill immediately on a fresh database —
 * often before `just db-load-seeds` has run. Keep only queue-draining enabled by default.
 *
 * Set `TACHI_ENABLE_ALL_CRONS=1` to register the full production cron set in dev.
 */
export function filterCronTasksForEnvironment(
	defs: Array<CronTaskDef>,
	nodeEnv: typeof Env.NODE_ENV = Env.NODE_ENV,
	enableAllCrons = process.env.TACHI_ENABLE_ALL_CRONS === "1",
): Array<CronTaskDef> {
	if (nodeEnv !== "dev" || enableAllCrons) {
		return defs;
	}
	const allowed = new Set<string>(DEV_LOCAL_CRON_TASK_IDS);
	return defs.filter((d) => allowed.has(d.id));
}

let cached: Array<CronTaskDef> | undefined;

/**
 * In-memory cron definitions (code is authoritative for schedules; rows are upserted to Postgres).
 */
export function getCronTaskDefinitions(): Array<CronTaskDef> {
	if (!cached) {
		cached = buildList();
	}
	return cached;
}
