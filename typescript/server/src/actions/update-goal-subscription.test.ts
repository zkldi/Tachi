import DB from "#services/pg/db";
import { seedMinimalIidxSpChart, seedUser } from "#test-utils/pg-fixtures";
import { GetGoalForIDGuaranteed, GetGoalSubscriptionForIDGuaranteed } from "#utils/db";
import { beforeEach, describe, expect, it } from "vitest";

import { ACTION_AddGoal } from "./add-goal";
import { ACTION_UpdateGoalSubscription } from "./update-goal-subscription";

describe("ACTION_UpdateGoalSubscription", () => {
	let userID: number;
	let username: string;
	let chartId: string;
	let taker: { acct: { id: number; username: string }; ip: string };

	const baseInput = {
		game: "iidx-sp" as const,
		charts: { type: "single" as const, data: "" },
		criteria: { key: "lamp" as const, value: 7, mode: "single" as const },
	};

	beforeEach(async () => {
		({ id: userID, username } = await seedUser({ username: `goal_update_${Date.now()}` }));
		chartId = await seedMinimalIidxSpChart();
		taker = { ip: "127.0.0.1", acct: { id: userID, username } };
	});

	it("throws 403 when targeting another user as non-admin", async () => {
		const other = await seedUser({ username: `goal_upd_other_${Date.now()}` });

		await expect(
			ACTION_UpdateGoalSubscription(taker, {
				...baseInput,
				userID: other.id,
				charts: { type: "single", data: chartId },
				oldGoalID: "G_fake",
			}),
		).rejects.toMatchObject({ code: 403 });
	});

	it("throws 404 when the user is not subscribed to the old goal", async () => {
		await expect(
			ACTION_UpdateGoalSubscription(taker, {
				...baseInput,
				userID,
				charts: { type: "single", data: chartId },
				oldGoalID: "G_does_not_exist",
			}),
		).rejects.toMatchObject({ code: 404 });
	});

	it("throws 400 when the goal was assigned by a quest (not standalone)", async () => {
		const { goalID } = await ACTION_AddGoal(taker, {
			...baseInput,
			userID,
			charts: { type: "single", data: chartId },
		});

		await DB.updateTable("goal_sub")
			.set({ was_assigned_standalone: false })
			.where("goal_sub.goal_id", "=", goalID)
			.where("goal_sub.user_id", "=", userID)
			.execute();

		const secondChart = await seedMinimalIidxSpChart();

		await expect(
			ACTION_UpdateGoalSubscription(taker, {
				...baseInput,
				userID,
				oldGoalID: goalID,
				charts: { type: "single", data: secondChart },
			}),
		).rejects.toMatchObject({ code: 400 });
	});

	it("returns changed: false when the new definition is identical to the old one", async () => {
		const { goalID } = await ACTION_AddGoal(taker, {
			...baseInput,
			userID,
			charts: { type: "single", data: chartId },
		});

		const result = await ACTION_UpdateGoalSubscription(taker, {
			...baseInput,
			userID,
			oldGoalID: goalID,
			charts: { type: "single", data: chartId },
		});

		expect(result).toMatchObject({ changed: false, newGoalID: goalID });

		const sub = await GetGoalSubscriptionForIDGuaranteed(goalID, userID);
		expect(sub).toBeDefined();
	});

	it("swaps subscription from old goal to new goal", async () => {
		const { goalID: oldGoalID } = await ACTION_AddGoal(taker, {
			...baseInput,
			userID,
			charts: { type: "single", data: chartId },
		});

		const secondChart = await seedMinimalIidxSpChart();

		const result = await ACTION_UpdateGoalSubscription(taker, {
			...baseInput,
			userID,
			oldGoalID,
			charts: { type: "single", data: secondChart },
		});

		expect(result.changed).toBe(true);
		expect(result.newGoalID).not.toBe(oldGoalID);

		const newGoal = await GetGoalForIDGuaranteed(result.newGoalID);
		expect(newGoal.charts).toMatchObject({ type: "single", data: secondChart });

		const newSub = await GetGoalSubscriptionForIDGuaranteed(result.newGoalID, userID);
		expect(newSub).toBeDefined();

		const oldSub = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_sub.goal_id", "=", oldGoalID)
			.where("goal_sub.user_id", "=", userID)
			.executeTakeFirst();

		expect(oldSub).toBeUndefined();
	});

	it("writes a GOOD action row on success", async () => {
		const { goalID: oldGoalID } = await ACTION_AddGoal(taker, {
			...baseInput,
			userID,
			charts: { type: "single", data: chartId },
		});

		const secondChart = await seedMinimalIidxSpChart();

		await ACTION_UpdateGoalSubscription(taker, {
			...baseInput,
			userID,
			oldGoalID,
			charts: { type: "single", data: secondChart },
		});

		const actionRow = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_GOAL_SUBSCRIPTION")
			.orderBy("action.ts_start", "desc")
			.executeTakeFirstOrThrow();

		expect(actionRow).toMatchObject({
			result: "GOOD",
			ip: "127.0.0.1",
			user_id: userID,
		});
	});

	it("throws 400 when the new chart does not exist", async () => {
		const { goalID: oldGoalID } = await ACTION_AddGoal(taker, {
			...baseInput,
			userID,
			charts: { type: "single", data: chartId },
		});

		await expect(
			ACTION_UpdateGoalSubscription(taker, {
				...baseInput,
				userID,
				oldGoalID,
				charts: { type: "single", data: "C_fake_chart" },
			}),
		).rejects.toMatchObject({ code: 400 });
	});
});
