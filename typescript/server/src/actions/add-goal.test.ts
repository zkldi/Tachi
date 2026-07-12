import DB from "#services/pg/db";
import { seedMinimalIidxSpChart, seedUser } from "#test-utils/pg-fixtures";
import { GetGoalForIDGuaranteed, GetGoalSubscriptionForIDGuaranteed } from "#utils/db";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_AddGoal } from "./add-goal";

describe("ACTION_AddGoal", () => {
	let userID: number;
	let username: string;

	beforeEach(async () => {
		({ id: userID, username } = await seedUser({ username: `goal_add_${Date.now()}` }));
	});

	it("throws 403 when targeting another user as non-admin", async () => {
		const other = await seedUser({ username: `goal_add_other_${Date.now()}` });
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		await expect(
			ACTION_AddGoal(taker, {
				userID: other.id,
				game: "iidx-sp",
				charts: { type: "single", data: "chart" },
				criteria: { key: "lamp", value: 0, mode: "single" },
			}),
		).rejects.toMatchObject({ code: 403 });
	});

	it("inserts goal and goal_sub rows when criteria are valid and the user has no PB", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		const { goalID } = await ACTION_AddGoal(taker, {
			userID,
			game: "iidx-sp",
			charts: { type: "single", data: chartId },
			criteria: { key: "lamp", value: 7, mode: "single" },
		});

		const goal = await GetGoalForIDGuaranteed(goalID);
		const goalSub = await GetGoalSubscriptionForIDGuaranteed(goalID, userID);
		expect(goalSub).toMatchObject({
			goalID,
			userID,
		});

		const goalRow = await DB.selectFrom("goal")
			.selectAll()
			.where("id", "=", goalID)
			.executeTakeFirst();

		expect(goalRow).toMatchObject({
			id: goal.goalID,
			game: "iidx-sp",
			name: goal.name,
		});

		const subRow = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_id", "=", goal.goalID)
			.where("user_id", "=", userID)
			.executeTakeFirst();

		expect(subRow).toMatchObject({
			goal_id: goal.goalID,
			user_id: userID,
			achieved: false,
		});
	});

	it("writes a GOOD ADD_GOAL action row on success", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const taker = { ip: "10.1.2.3", acct: { id: userID, username } };

		await ACTION_AddGoal(taker, {
			userID: userID,
			game: "iidx-sp",
			charts: { type: "single", data: chartId },
			criteria: { key: "lamp", value: 7, mode: "single" },
		});

		const actionRow = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "ADD_GOAL")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(actionRow).toMatchObject({
			result: "GOOD",
			ip: "10.1.2.3",
			user_id: userID,
		});
	});

	it("throws 400 for an invalid criteria key", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		await expect(
			ACTION_AddGoal(taker, {
				userID: userID,
				game: "iidx-sp",
				charts: { type: "single", data: chartId },
				criteria: { key: "not_a_real_metric", value: 0, mode: "single" },
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 400 when the chart does not exist", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		await expect(
			ACTION_AddGoal(taker, {
				userID: userID,
				game: "iidx-sp",
				charts: { type: "single", data: "C_fake" },
				criteria: { key: "lamp", value: 7, mode: "single" },
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("throws 409 when the user is already subscribed to that goal", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		const input = {
			userID: userID,
			game: "iidx-sp" as const,
			charts: { type: "single" as const, data: chartId },
			criteria: { key: "lamp" as const, value: 7, mode: "single" as const },
		};

		await ACTION_AddGoal(taker, input);

		await expect(ACTION_AddGoal(taker, input)).rejects.toMatchObject({ code: 409 });
	});
});
