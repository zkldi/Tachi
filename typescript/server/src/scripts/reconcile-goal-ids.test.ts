import { reconcileGoalIds } from "#scripts/reconcile-goal-ids";
import { CreateGoalID } from "#lib/targets/goals";
import DB from "#services/pg/db";
import { seedMinimalIidxSpChart, seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

describe("reconcileGoalIds", () => {
	it("renames drifted goal ids and cascades goal_sub references", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const { id: userId } = await seedUser();

		const charts = { type: "single" as const, data: chartId };
		const criteria = { mode: "single" as const, value: 5, key: "lamp" as const };
		const game = "iidx-sp" as const;
		const canonicalId = CreateGoalID(charts, criteria, game);
		const driftedId = "G_wrong_goal_id_drifted_for_reconcile_test";

		expect(canonicalId).not.toBe(driftedId);

		await DB.insertInto("goal")
			.values({
				id: driftedId,
				game,
				name: "HARD CLEAR test chart",
				charts,
				criteria,
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: driftedId,
				user_id: userId,
				last_interaction: null,
				progress: 0,
				progress_human: "0",
				out_of: 5,
				out_of_human: "HARD CLEAR",
				achieved: false,
				time_achieved: null,
				was_instantly_achieved: false,
				was_assigned_standalone: true,
			})
			.execute();

		const { renamed } = await reconcileGoalIds({ dryRun: false });

		expect(renamed).toBe(1);

		const goalRow = await DB.selectFrom("goal")
			.select("goal.id")
			.where("goal.id", "=", canonicalId)
			.executeTakeFirst();

		expect(goalRow).toBeDefined();

		const staleGoal = await DB.selectFrom("goal")
			.select("goal.id")
			.where("goal.id", "=", driftedId)
			.executeTakeFirst();

		expect(staleGoal).toBeUndefined();

		const subRow = await DB.selectFrom("goal_sub")
			.select("goal_sub.goal_id")
			.where("goal_sub.user_id", "=", userId)
			.executeTakeFirst();

		expect(subRow?.goal_id).toBe(canonicalId);
	});
});
