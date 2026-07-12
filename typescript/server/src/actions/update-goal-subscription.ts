import { MakeAction } from "#lib/actions/actions";
import { SubscribeFailReasons } from "#lib/constants/err-codes";
import { SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { ToGoalSubscriptionDocument } from "#lib/db-formats/target-documents";
import { ConstructGoal, SubscribeToGoal } from "#lib/targets/goals";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { type GoalDocument } from "tachi-common";

export const ACTION_UpdateGoalSubscription = MakeAction(
	"UPDATE_GOAL_SUBSCRIPTION",
	async (taker, input) => {
		const { userID, game, oldGoalID, charts, criteria } = input;

		if (taker.acct.id !== userID && !(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorised to modify this user's goals.");
		}

		const existingSubRow = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", userID)
			.where("goal_sub.goal_id", "=", oldGoalID)
			.where("goal.game", "=", game)
			.executeTakeFirst();

		if (!existingSubRow) {
			throw new ExpectedErr(404, "You are not subscribed to this goal.");
		}

		const existingSub = ToGoalSubscriptionDocument(existingSubRow);

		if (!existingSub.wasAssignedStandalone) {
			throw new ExpectedErr(
				400,
				"This goal was assigned by a quest and cannot be updated directly. Unsubscribe from the quest to modify its goals.",
			);
		}

		let newGoal: GoalDocument;

		try {
			newGoal = await ConstructGoal(
				charts as GoalDocument["charts"],
				criteria as GoalDocument["criteria"],
				game,
			);
		} catch (e) {
			throw new ExpectedErr(400, (e as Error).message);
		}

		if (newGoal.goalID === oldGoalID) {
			return { newGoalID: oldGoalID, changed: false };
		}

		await DB.deleteFrom("goal_sub")
			.where("goal_sub.goal_id", "=", oldGoalID)
			.where("goal_sub.user_id", "=", userID)
			.execute();

		const subResult = await SubscribeToGoal(userID, newGoal, true);

		if (
			subResult === SubscribeFailReasons.ALREADY_SUBSCRIBED ||
			subResult === SubscribeFailReasons.ALREADY_ACHIEVED
		) {
			throw new ExpectedErr(
				409,
				"Your updated goal conflicts with an existing subscription.",
			);
		}

		return { newGoalID: newGoal.goalID, changed: true };
	},
);
