import DB from "#services/pg/db";
import { seedMinimalIidxSpChart, seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_AddGoal } from "./add-goal";
import { ACTION_RemoveGoalSubscription } from "./remove-goal-subscription";

describe("ACTION_RemoveGoalSubscription", () => {
	let userID: number;
	let username: string;

	beforeEach(async () => {
		({ id: userID, username } = await seedUser({ username: `goal_rm_${Date.now()}` }));
	});

	it("throws 403 when targeting another user as non-admin", async () => {
		const other = await seedUser({ username: `goal_rm_other_${Date.now()}` });
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		await expect(
			ACTION_RemoveGoalSubscription(taker, {
				userID: other.id,
				game: "iidx-sp",
				goalID: "Gfake",
			}),
		).rejects.toMatchObject({ code: 403 });
	});

	it("throws 404 when the user is not subscribed to the goal", async () => {
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		await expect(
			ACTION_RemoveGoalSubscription(taker, {
				userID: userID,
				game: "iidx-sp",
				goalID: "Gnonexistent_goal_id_xyz",
			}),
		).rejects.toMatchObject({ code: 404 });
	});

	it("deletes goal_sub when the user was subscribed", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const taker = { ip: "127.0.0.1", acct: { id: userID, username } };

		const { goalID } = await ACTION_AddGoal(taker, {
			userID,
			game: "iidx-sp",
			charts: { type: "single", data: chartId },
			criteria: { key: "lamp", value: 7, mode: "single" },
		});

		await ACTION_RemoveGoalSubscription(taker, {
			userID,
			game: "iidx-sp",
			goalID,
		});

		const subRow = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_id", "=", goalID)
			.where("user_id", "=", userID)
			.executeTakeFirst();

		expect(subRow).toBeUndefined();
	});

	it("writes a GOOD REMOVE_GOAL_SUBSCRIPTION action row on success", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const taker = { ip: "10.4.5.6", acct: { id: userID, username } };

		const { goalID } = await ACTION_AddGoal(taker, {
			userID: userID,
			game: "iidx-sp",
			charts: { type: "single", data: chartId },
			criteria: { key: "lamp", value: 7, mode: "single" },
		});

		await ACTION_RemoveGoalSubscription(taker, {
			userID: userID,
			game: "iidx-sp",
			goalID,
		});

		const actionRow = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "REMOVE_GOAL_SUBSCRIPTION")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(actionRow).toMatchObject({
			result: "GOOD",
			ip: "10.4.5.6",
			user_id: userID,
		});
	});

	it("writes a BAD action row when removal fails with 404", async () => {
		const taker = { ip: "10.7.8.9", acct: { id: userID, username } };

		await expect(
			ACTION_RemoveGoalSubscription(taker, {
				userID: userID,
				game: "iidx-sp",
				goalID: "Gmissing_subscription",
			}),
		).rejects.toMatchObject({ code: 404 });

		const actionRow = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "REMOVE_GOAL_SUBSCRIPTION")
			.orderBy("ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(actionRow).toMatchObject({
			result: "BAD",
			ip: "10.7.8.9",
			user_id: userID,
		});
	});
});
