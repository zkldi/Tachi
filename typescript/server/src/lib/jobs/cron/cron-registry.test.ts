import { describe, expect, it } from "vitest";

import {
	type CronTaskDef,
	DEV_LOCAL_CRON_TASK_IDS,
	filterCronTasksForEnvironment,
} from "./cron-registry";

const sampleDefs: Array<CronTaskDef> = [
	{
		id: "drain_stats_queues",
		schedule: "* * * * *",
		description: "Drain stats queues",
		run: async () => {},
	},
	{
		id: "update_bms_tables",
		schedule: "3 0 * * *",
		description: "Update Tables (BMS)",
		run: async () => {},
	},
	{
		id: "backsync_bms_pms",
		schedule: "4 0 * * *",
		description: "Backsync BMS + PMS",
		run: async () => {},
	},
];

describe("filterCronTasksForEnvironment", () => {
	it("dev: keeps only local-safe crons by default", () => {
		expect(filterCronTasksForEnvironment(sampleDefs, "dev", false).map((d) => d.id)).toEqual([
			...DEV_LOCAL_CRON_TASK_IDS,
		]);
	});

	it("dev: can opt into the full cron set", () => {
		expect(filterCronTasksForEnvironment(sampleDefs, "dev", true)).toEqual(sampleDefs);
	});

	it("production and test: leave the registry unchanged", () => {
		for (const nodeEnv of ["production", "test", "staging"] as const) {
			expect(filterCronTasksForEnvironment(sampleDefs, nodeEnv, false)).toEqual(sampleDefs);
		}
	});
});
