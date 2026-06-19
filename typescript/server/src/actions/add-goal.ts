import { MakeAction } from "#lib/actions/actions";
import { SubscribeFailReasons } from "#lib/constants/err-codes";
import { ServerConfig } from "#lib/setup/config";
import { ConstructGoal, SubscribeToGoal } from "#lib/targets/goals";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";
import { GetGameConfig, type GoalDocument } from "tachi-common";

export const ACTION_AddGoal = MakeAction("ADD_GOAL", async (taker, input) => {
	const { userID, game, charts, criteria } = input;

	if (taker.acct.id !== userID && !(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorised to modify this user's goals.");
	}

	const row = await DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(sql<number>`count(*)::int`.as("c"))
		.where("goal_sub.user_id", "=", userID)
		.where("goal.game", "=", game)
		.executeTakeFirst();

	const existingGoalsCount = Number(row?.c ?? 0);

	if (existingGoalsCount > ServerConfig.MAX_GOAL_SUBSCRIPTIONS) {
		throw new ExpectedErr(
			400,
			`You already have ${ServerConfig.MAX_GOAL_SUBSCRIPTIONS} goals. You cannot have anymore.`,
		);
	}

	const gameConfig = GetGameConfig(game);

	const isCalculated = (criteria as { source?: string }).source === "calculated";

	const validCriteria = isCalculated
		? Object.entries(gameConfig.scoreRatingAlgs)
				.filter(([, conf]) => conf.canSetGoalsOn)
				.map(([key]) => key)
		: [...Object.keys(gameConfig.providedMetrics), ...Object.keys(gameConfig.derivedMetrics)];

	const criteriaKey = (criteria as { key?: string }).key;

	if (typeof criteriaKey !== "string" || !validCriteria.includes(criteriaKey)) {
		throw new ExpectedErr(
			400,
			`Invalid criteria '${String(criteriaKey)}', expected any of ${validCriteria.join(", ")}.`,
		);
	}

	let goal: GoalDocument;

	try {
		goal = await ConstructGoal(
			charts as GoalDocument["charts"],
			criteria as GoalDocument["criteria"],
			game,
		);
	} catch (e) {
		throw new ExpectedErr(400, (e as Error).message);
	}

	const goalSub = await SubscribeToGoal(userID, goal, true);

	if (goalSub === SubscribeFailReasons.ALREADY_SUBSCRIBED) {
		throw new ExpectedErr(409, "You are already subscribed to this goal.");
	}

	if (goalSub === SubscribeFailReasons.ALREADY_ACHIEVED) {
		throw new ExpectedErr(
			400,
			"You can't directly assign goals that you would immediately achieve.",
		);
	}

	return { goalID: goal.goalID };
});
