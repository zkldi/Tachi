import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { SELECT_QUEST_SUB_WITH_QUEST_GAME } from "#lib/db-formats/quest";
import {
	AttachFolderSlugsToGoals,
	ToGoalDocument,
	ToGoalSubscriptionDocument,
	ToQuestSubscriptionDocument,
} from "#lib/db-formats/target-documents";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { GetParentQuests } from "#lib/targets/quests";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";
import { type GoalDocument } from "tachi-common";

/**
 * Retrieves this user's set goals for this GPT.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/goals
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/goals",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const subRows = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", user.id)
			.where("goal.game", "=", game)
			.execute();

		const goalSubs = subRows.map((r) => ToGoalSubscriptionDocument(r));
		const goalIds = goalSubs.map((e) => e.goalID);

		const goalRows =
			goalIds.length === 0
				? []
				: await DB.selectFrom("goal")
						.select(SELECT_GOAL)
						.where("goal.id", "in", goalIds)
						.execute();

		const goals = goalRows.map(ToGoalDocument);
		await AttachFolderSlugsToGoals(goals);
		const allQuests = await GetParentQuests(user.id, game, goalSubs);

		const questSubRows = await DB.selectFrom("quest_sub")
			.innerJoin("quest", "quest.id", "quest_sub.quest_id")
			.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
			.where("quest_sub.user_id", "=", user.id)
			.where("quest.game", "=", game)
			.execute();

		const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));
		const questSubIDs = questSubs.map((e) => e.questID);
		const quests = allQuests.filter((quest) => questSubIDs.includes(quest.questID));

		return success(`Retrieved ${goalSubs.length} goal(s).`, {
			goalSubs,
			goals,
			questSubs,
			quests,
		});
	},
);

/**
 * Add a goal to your account.
 *
 * @name POST /api/v1/users/:userID/games/:game/targets/goals/add-goal
 */
API_V1_ROUTER.add(
	"POST /users/:userID/games/:game/targets/goals/add-goal",
	withUserGameProfile,
	async ({ ctx, input, req }) => {
		const { requestedUser: user, game } = ctx;

		const sessionUser = req.session.tachi?.user;

		if (!sessionUser) {
			throw new ExpectedErr(401, "You are not authenticated.");
		}

		const taker = { acct: { id: sessionUser.id, username: sessionUser.username }, ip: req.ip };

		const { ACTION_AddGoal } = await import("#actions/add-goal");
		const { GetGoalForIDGuaranteed, GetGoalSubscriptionForIDGuaranteed } = await import(
			"#utils/db"
		);

		const { goalID } = await ACTION_AddGoal(taker, {
			charts: input.charts as GoalDocument["charts"],
			criteria: input.criteria as GoalDocument["criteria"],
			game,
			userID: user.id,
		});

		const goal = await GetGoalForIDGuaranteed(goalID);
		const goalSub = await GetGoalSubscriptionForIDGuaranteed(goalID, user.id);

		return success(`Subscribed to ${goal.name}.`, { goal, goalSub });
	},
);

/**
 * Reads information about the users subscription to this goal ID.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/goals/:goalID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/goals/:goalID",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const row = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", user.id)
			.where("goal_sub.goal_id", "=", params.goalID)
			.where("goal.game", "=", game)
			.executeTakeFirst();

		if (!row) {
			throw new ExpectedErr(404, `${user.username} is not subscribed to this goal.`);
		}

		const goalSub = ToGoalSubscriptionDocument(row);
		const { GetGoalForIDGuaranteed } = await import("#utils/db");
		const { GetQuestsThatContainGoal } = await import("#lib/targets/goals");

		const goal = await GetGoalForIDGuaranteed(goalSub.goalID);
		const quests = await GetQuestsThatContainGoal(goalSub.goalID);

		return success(`Returned information about goal '${goal.name}'.`, {
			goal,
			goalSub,
			quests,
			user,
		});
	},
);

/**
 * Update a standalone goal subscription by replacing its definition.
 *
 * Creates a new goal from the provided charts/criteria and atomically swaps
 * the user's subscription from the old goal to the new one. Progress is
 * re-evaluated from scores on the next import — no migration is needed.
 *
 * Only standalone goals (not quest-assigned goals) may be updated this way.
 *
 * @name PUT /api/v1/users/:userID/games/:game/targets/goals/:goalID
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/games/:game/targets/goals/:goalID",
	withUserGameProfile,
	async ({ ctx, params, input, req }) => {
		const { requestedUser: user, game } = ctx;

		const sessionUser = req.session.tachi?.user;

		if (!sessionUser) {
			throw new ExpectedErr(401, "You are not authenticated.");
		}

		const taker = { acct: { id: sessionUser.id, username: sessionUser.username }, ip: req.ip };

		const { ACTION_UpdateGoalSubscription } = await import("#actions/update-goal-subscription");
		const { GetGoalForIDGuaranteed, GetGoalSubscriptionForIDGuaranteed } = await import(
			"#utils/db"
		);

		const { newGoalID, changed } = await ACTION_UpdateGoalSubscription(taker, {
			charts: input.charts as GoalDocument["charts"],
			criteria: input.criteria as GoalDocument["criteria"],
			game,
			oldGoalID: params.goalID,
			userID: user.id,
		});

		const newGoal = await GetGoalForIDGuaranteed(newGoalID);
		const newGoalSub = await GetGoalSubscriptionForIDGuaranteed(newGoalID, user.id);

		return success(
			changed ? `Updated goal to '${newGoal.name}'.` : "Goal definition is unchanged.",
			{ changed, goal: newGoal, goalSub: newGoalSub },
		);
	},
);

/**
 * Unsubscribe from a goal.
 *
 * @name DELETE /api/v1/users/:userID/games/:game/targets/goals/:goalID
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/games/:game/targets/goals/:goalID",
	withUserGameProfile,
	async ({ ctx, params, req }) => {
		const { requestedUser: user, game } = ctx;

		const sessionUser = req.session.tachi?.user;

		if (!sessionUser) {
			throw new ExpectedErr(401, "You are not authenticated.");
		}

		const taker = { acct: { id: sessionUser.id, username: sessionUser.username }, ip: req.ip };

		const { ACTION_RemoveGoalSubscription } = await import("#actions/remove-goal-subscription");

		await ACTION_RemoveGoalSubscription(taker, {
			game,
			goalID: params.goalID,
			userID: user.id,
		});

		return success("Removed this goal from your subscriptions.", {});
	},
);
