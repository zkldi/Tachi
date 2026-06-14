import { SubscribeFailReasons } from "#lib/constants/err-codes";
import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import {
	SELECT_QUEST,
	SELECT_QUEST_SUB,
	SELECT_QUEST_SUB_WITH_QUEST_GAME,
} from "#lib/db-formats/quest";
import {
	ToGoalDocument,
	ToGoalSubscriptionDocument,
	ToQuestDocument,
	ToQuestSubscriptionDocument,
} from "#lib/db-formats/target-documents";
import { log } from "#lib/log/log";
import { BulkSendNotification } from "#lib/notifications/notifications";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { sql } from "kysely";
import {
	type GoalDocument,
	type GoalSubscriptionDocument,
	type integer,
	type QuestDocument,
	type QuestSubscriptionDocument,
	type V3Game,
} from "tachi-common";

import {
	type EvaluatedGoalReturn,
	EvaluateGoalForUser,
	SubscribeToGoal,
	UnsubscribeFromGoal,
	UnsubscribeFromOrphanedGoalSubs,
} from "./goals";

/**
 * Retrieves the goalID documents in a single array from the
 * nested structure of quests.
 */
export function GetGoalIDsFromQuest(quest: QuestDocument) {
	return quest.questData.map((e) => e.goals.map((e) => e.goalID)).flat(1);
}

/**
 * Return all the goals inside this quest.
 */
export async function GetGoalsInQuest(quest: QuestDocument) {
	const goalIDs = GetGoalIDsFromQuest(quest);

	if (goalIDs.length === 0) {
		return [];
	}

	const goals = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", "in", goalIDs)
		.execute();

	if (goals.length !== goalIDs.length) {
		log.error(
			{ goals: goals.length, quest, goalIDs: goalIDs.length },
			`Quest ${quest.name} has ${goalIDs.length} goals registered, but we could only find ${goals.length} in the database?`,
		);
		throw new Error(`Quest is corrupt. Not the right amount of goals in db?`);
	}

	if (goalIDs.length < 2) {
		log.warn(
			{
				quest,
			},
			`Quest ${quest.name} resolves to less than 2 goals. Isn't a valid quest?`,
		);
	}

	return goals.map(ToGoalDocument);
}

/**
 * Return all the goals inside these quests
 */
export async function GetGoalsInQuests(quests: Array<QuestDocument>) {
	const goalIDs = quests.flatMap((quest) => GetGoalIDsFromQuest(quest));

	if (goalIDs.length === 0) {
		return [];
	}

	const goals = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", "in", goalIDs)
		.execute();

	return goals.map(ToGoalDocument);
}

/**
 * Work out how many goals need to be achieved for this
 * quest to be considered completed.
 */
export function CalculateQuestOutOf(quest: QuestDocument) {
	const goalIDs = GetGoalIDsFromQuest(quest);

	return goalIDs.length;
}

type EvaluatedGoalResult = { goalID: string } & EvaluatedGoalReturn;

/**
 * Evaluate a user's progress on a quest, regardless of whether they have it
 * assigned or not.
 *
 * @returns All of the goals in the quest. The users progress on each individual goal,
 * their overall progress, what the quest was outOf, and whether they achieved it or
 * not.
 */
export async function EvaluateQuestProgress(userID: integer, quest: QuestDocument) {
	const goals = await GetGoalsInQuest(quest);

	const isSubscribedToQuest = await DB.selectFrom("quest_sub")
		.select(SELECT_QUEST_SUB)
		.where("quest_sub.quest_id", "=", quest.questID)
		.where("quest_sub.user_id", "=", userID)
		.executeTakeFirst();

	const goalSubMap = new Map<string, GoalSubscriptionDocument>();

	if (isSubscribedToQuest && goals.length > 0) {
		const goalSubRows = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", userID)
			.where(
				"goal_sub.goal_id",
				"in",
				goals.map((e) => e.goalID),
			)
			.execute();

		for (const row of goalSubRows) {
			goalSubMap.set(row.goal_id, ToGoalSubscriptionDocument(row));
		}
	}

	const goalResults: Array<EvaluatedGoalResult> = await Promise.all(
		goals.map(async (goal) => {
			if (isSubscribedToQuest) {
				let goalSub = goalSubMap.get(goal.goalID);

				if (!goalSub) {
					log.warn(
						`User ${userID} has a corrupt subscription to quest '${quest.name}', They do not have all the goals in this quest assigned. Automatically subscribing them to the new goal.`,
					);

					const newGoalSub = await SubscribeToGoal(userID, goal, false);

					if (newGoalSub === SubscribeFailReasons.ALREADY_SUBSCRIBED) {
						log.error(
							`User ${userID} wasn't subscribed to a goal (${goal.goalID}), but subscription failed because they were already subscribed. This should never happen.`,
						);
						throw new Error(
							`Quest subscription was corrupt and we failed to subscribe the user to the missing goal.`,
						);
					}

					if (newGoalSub === SubscribeFailReasons.ALREADY_ACHIEVED) {
						log.error(
							`Impossible via typesystem: attempted resubscription for user ${userID} on goal ${goal.goalID}, was rejected for being already achieved. Not possible, as we allow already achieved goals here.`,
						);

						throw new Error(
							`Quest subscription was corrupt and we failed to subscribe the user to the missing goal.`,
						);
					}

					goalSub = newGoalSub;
				}

				const gSub = goalSub;

				return {
					achieved: gSub.achieved,
					progress: gSub.progress,
					outOf: gSub.outOf,
					progressHuman: gSub.progressHuman,
					outOfHuman: gSub.outOfHuman,
					goalID: goal.goalID,
				};
			}

			const result = await EvaluateGoalForUser(goal, userID, log);

			if (!result) {
				log.error(
					{ goal, quest },
					`Failed to calculate ${userID} result for goal '${goal.name}'. Is the goal valid?`,
				);

				throw new Error(`Goal inside quest is corrupt.`);
			}

			return {
				achieved: result.achieved,
				progress: result.progress,
				outOf: result.outOf,
				progressHuman: result.progressHuman,
				outOfHuman: result.outOfHuman,
				goalID: goal.goalID,
			};
		}),
	);

	const progress = goalResults.filter((e) => e.achieved).length;
	const outOf = CalculateQuestOutOf(quest);

	const achieved = progress >= outOf;

	return {
		goals,
		goalResults,
		achieved,
		progress,
		outOf,
	};
}

interface QuestSubscriptionReturns {
	questSub: QuestSubscriptionDocument;
	goals: Array<GoalDocument>;
	goalResults: Array<EvaluatedGoalResult>;
}

/**
 * Subscribes the given user to a provided quest. If the user is already subscribed,
 * null is returned.
 *
 * @param denyInstantAchievement - Don't subscribe to the quest if subscribing would cause
 * the user to immediately achieve it.
 */
export async function SubscribeToQuest(
	userID: integer,
	quest: QuestDocument,
	denyInstantAchievement: false,
): Promise<QuestSubscriptionReturns | SubscribeFailReasons.ALREADY_SUBSCRIBED>;
export async function SubscribeToQuest(
	userID: integer,
	quest: QuestDocument,
	denyInstantAchievement = true,
): Promise<
	| QuestSubscriptionReturns
	| SubscribeFailReasons.ALREADY_ACHIEVED
	| SubscribeFailReasons.ALREADY_SUBSCRIBED
> {
	const isSubscribedToQuest = await DB.selectFrom("quest_sub")
		.select(SELECT_QUEST_SUB)
		.where("quest_sub.quest_id", "=", quest.questID)
		.where("quest_sub.user_id", "=", userID)
		.executeTakeFirst();

	if (isSubscribedToQuest) {
		return SubscribeFailReasons.ALREADY_SUBSCRIBED;
	}

	const result = await EvaluateQuestProgress(userID, quest);

	if (result.achieved && denyInstantAchievement) {
		return SubscribeFailReasons.ALREADY_ACHIEVED;
	}

	const nowMs = Date.now();
	const nowIso = UnixMillisecondsToISO8601(nowMs);

	const questSubBase = {
		progress: result.progress,
		userID,
		questID: quest.questID,
		wasInstantlyAchieved: result.achieved,
		game: quest.game,
		lastInteraction: null,
	};

	const questSub: QuestSubscriptionDocument = result.achieved
		? {
				...questSubBase,
				achieved: true,
				timeAchieved: nowMs,
			}
		: {
				...questSubBase,
				achieved: false,
				timeAchieved: null,
			};

	await Promise.all(result.goals.map((goal) => SubscribeToGoal(userID, goal, false)));

	await DB.insertInto("quest_sub")
		.values({
			quest_id: quest.questID,
			user_id: userID,
			progress: questSub.progress,
			last_interaction: null,
			achieved: questSub.achieved,
			time_achieved: result.achieved ? nowIso : null,
			was_instantly_achieved: questSub.wasInstantlyAchieved,
		})
		.execute();

	log.info(`User ${userID} subscribed to '${quest.name}'.`);

	return { questSub, goals: result.goals, goalResults: result.goalResults };
}

/**
 * Given a questID, update all of its subscriptions to potentially subscribe to any
 * new goals added to it.
 *
 * @note Updating quest subscriptions just means ensuring that any subscribing
 * users are also subscribed to all goals in that quest. Nothing more.
 *
 * A quest that removes goals will not result in those users having goal subs removed.
 */
export async function UpdateQuestSubscriptions(questID: string) {
	log.info(`Received update-subscribe call to quest ${questID}.`);

	const subscriptions = await DB.selectFrom("quest_sub")
		.innerJoin("quest", "quest.id", "quest_sub.quest_id")
		.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
		.where("quest_sub.quest_id", "=", questID)
		.execute();

	const maybeQuest = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "=", questID)
		.executeTakeFirst();

	if (!maybeQuest) {
		await DB.deleteFrom("quest_sub").where("quest_sub.quest_id", "=", questID).execute();

		await Promise.all(
			subscriptions.map((e) => UnsubscribeFromOrphanedGoalSubs(e.user_id, e.quest_game)),
		);

		log.info(`Quest ${questID} has been deleted. Unsubscribed ${subscriptions.length} users.`);

		return;
	}

	const quest = ToQuestDocument(maybeQuest);

	const mappedSubs = subscriptions.map((e) => ToQuestSubscriptionDocument(e));

	await Promise.all(mappedSubs.map((e) => UnsubscribeFromQuest(e, quest)));

	await Promise.all(mappedSubs.map((e) => SubscribeToQuest(e.userID, quest, false)));

	await BulkSendNotification(
		`The quest '${quest.name}' has received an update.`,
		subscriptions.map((e) => e.user_id),
		{
			type: "QUEST_CHANGED",
			content: {
				questID,
				game: quest.game,
			},
		},
	);
}

/**
 * Unsubscribe from a quest. This will also unsubscribe the user from any goals they're
 * subscribed to as a result.
 *
 * Returns nothing.
 */
export async function UnsubscribeFromQuest(
	questSub: QuestSubscriptionDocument,
	quest: QuestDocument,
) {
	const goalIDs = GetGoalIDsFromQuest(quest);

	await DB.deleteFrom("quest_sub")
		.where("quest_sub.quest_id", "=", questSub.questID)
		.where("quest_sub.user_id", "=", questSub.userID)
		.execute();

	if (goalIDs.length > 0) {
		const goalSubRows = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", questSub.userID)
			.where("goal_sub.goal_id", "in", goalIDs)
			.execute();

		const goalSubs = goalSubRows.map((r) => ToGoalSubscriptionDocument(r));

		await Promise.all(goalSubs.map((e) => UnsubscribeFromGoal(e, true)));
	}
}

/**
 * Given an array of user goal subscriptions, return all the quests this user is
 * subscribed to that subsume these goals.
 */
export async function GetParentQuests(
	userID: integer,
	game: V3Game,
	goalSubs: Array<GoalSubscriptionDocument>,
) {
	const goalIds = goalSubs.map((e) => e.goalID);

	if (goalIds.length === 0) {
		return [];
	}

	const questSubRows = await DB.selectFrom("quest_sub")
		.innerJoin("quest", "quest.id", "quest_sub.quest_id")
		.select("quest_sub.quest_id")
		.where("quest_sub.user_id", "=", userID)
		.where("quest.game", "=", game)
		.execute();

	const questSubIDs = questSubRows.map((e) => e.quest_id);

	if (questSubIDs.length === 0) {
		return [];
	}

	const questRows = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "in", questSubIDs)
		.execute();

	return questRows
		.filter((q) => {
			const doc = ToQuestDocument(q);

			return doc.questData.some((section) =>
				section.goals.some((g) => goalIds.includes(g.goalID)),
			);
		})
		.map(ToQuestDocument);
}

/**
 * Find all quests not in any questlines.
 */
export async function FindStandaloneQuests(game: V3Game) {
	const rows = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.game", "=", game)
		.where(
			sql<boolean>`not exists (
				select 1 from questline_quest qq where qq.quest_id = quest.id
			)`,
		)
		.execute();

	return rows.map(ToQuestDocument);
}
