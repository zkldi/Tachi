import { MakeAction } from "#lib/actions/actions";
import { SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { ToGoalSubscriptionDocument } from "#lib/db-formats/target-documents";
import { UnsubscribeFromGoal } from "#lib/targets/goals";
import DB from "#services/pg/db";
import { staticAssertUnreachable } from "#utils/misc";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_RemoveGoalSubscription = MakeAction(
	"REMOVE_GOAL_SUBSCRIPTION",
	async (taker, input) => {
		const { userID, game, goalID } = input;

		if (taker.acct.id !== userID && !(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorised to modify this user's goals.");
		}

		const row = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", userID)
			.where("goal_sub.goal_id", "=", goalID)
			.where("goal.game", "=", game)
			.executeTakeFirst();

		if (!row) {
			throw new ExpectedErr(404, "You are not subscribed to this goal.");
		}

		const goalSub = ToGoalSubscriptionDocument(row);

		const fail = await UnsubscribeFromGoal(goalSub, false);

		if (!fail) {
			return {};
		}

		switch (fail.reason) {
			case "HAS_QUEST_DEPENDENCIES":
				throw new ExpectedErr(
					400,
					`This goal is part of a quest you are subscribed to. It can only be removed by unsubscribing from the relevant quests: ${fail.parentQuests
						.map((e) => `'${e.quest.name}'`)
						.join(", ")}.`,
				);

			case "WAS_STANDALONE":
				throw new ExpectedErr(
					400,
					"This goal was assigned by you and can't be removed as a consequence of another action.",
				);

			default:
				staticAssertUnreachable(fail);
		}
	},
);
