import DB from "#services/pg/db";
import { afterEach, describe, expect, it } from "vitest";

import { GetCronTaskExecutions } from "./admin-queries";

const TEST_CHATTY_TASK = "test-cron-chatty-task";
const TEST_DAILY_TASK = "test-cron-daily-task";

async function cleanupTestExecutions() {
	await DB.deleteFrom("cron_task_execution")
		.where("task_id", "in", [TEST_CHATTY_TASK, TEST_DAILY_TASK])
		.execute();
}

describe("GetCronTaskExecutions", () => {
	afterEach(cleanupTestExecutions);

	it("caps results per task so a high-frequency task cannot crowd out other tasks", async () => {
		const now = Date.now();
		const isoAt = (offsetMs: number) => new Date(now - offsetMs).toISOString();

		// Insert 25 executions for a chatty minutely task — exceeds the 20-per-task cap.
		const chattyValues = Array.from({ length: 25 }, (_, i) => ({
			task_id: TEST_CHATTY_TASK,
			scheduled_at: isoAt(i * 60_000),
			status: "success" as const,
			completed_at: isoAt(i * 60_000 - 1_000),
			output: null,
			error: null,
		}));

		// Insert 3 executions for a daily task. These must not be crowded out.
		const dailyValues = Array.from({ length: 3 }, (_, i) => ({
			task_id: TEST_DAILY_TASK,
			scheduled_at: isoAt(i * 24 * 60 * 60_000),
			status: "success" as const,
			completed_at: isoAt(i * 24 * 60 * 60_000 - 1_000),
			output: null,
			error: null,
		}));

		await DB.insertInto("cron_task_execution")
			.values([...chattyValues, ...dailyValues])
			.execute();

		const results = await GetCronTaskExecutions();

		const chatty = results.filter((r) => r.task_id === TEST_CHATTY_TASK);
		const daily = results.filter((r) => r.task_id === TEST_DAILY_TASK);

		expect(chatty).toHaveLength(20);
		expect(daily).toHaveLength(3);
	});
});
