import db from "external/mongo/db";
import { EvaluateGoalForUser, GetRelevantGoals } from "lib/targets/goals";
import { EmitWebhookEvent } from "lib/webhooks/webhooks";
import type { KtLogger } from "lib/logger/logger";
import type { Game, GoalDocument, GoalSubscriptionDocument, integer } from "tachi-common";

/**
 * Update a user's progress on all of their set goals.
 */
export async function GetAndUpdateUsersGoals(
	game: Game,
	userID: integer,
	chartIDs: Set<string>,
	logger: KtLogger
) {
	const { goals, goalSubsMap } = await GetRelevantGoals(game, userID, chartIDs, logger);

	if (!goals.length) {
		// if we hit the below code with an empty array mongodb will flip out on the bulkwrite op
		return [];
	}

	logger.verbose(`Found ${goals.length} relevant goals.`);

	return UpdateGoalsForUser(goals, goalSubsMap, userID, logger);
}

export async function UpdateGoalsForUser(
	goals: Array<GoalDocument>,
	goalSubsMap: Map<string, GoalSubscriptionDocument>,
	userID: integer,
	logger: KtLogger,
	skipMismatch = false
) {
	const returns = await Promise.all(
		goals.map((goal: GoalDocument) => {
			const goalSub = goalSubsMap.get(goal.goalID);

			if (!goalSub) {
				if (skipMismatch) {
					return null;
				}

				logger.error(
					`UserGoal:GoalID mismatch ${goal.goalID} - this user has no goalSub for this, yet it is set.`
				);

				return null;
			}

			return ProcessGoal(goal, goalSub, userID, logger).catch((err: Error) => {
				logger.warn(
					`Failed to process goal '${goal.name}' for ${userID}, ${err.message}. Skipping.`,
					{ goal, err, userID, goalSub }
				);

				return null;
			});
		})
	);

	const importInfo = [];
	const bulkWrite = [];
	const webhookEventContent = [];

	for (const ret of returns) {
		if (!ret) {
			continue;
		}

		importInfo.push(ret.import);
		bulkWrite.push(ret.bwrite);

		if (ret.webhookEvent) {
			webhookEventContent.push(ret.webhookEvent);
		}
	}

	if (bulkWrite.length === 0) {
		// bulkwrite cannot be an empty array -- this means there's nothing to update or return, then.
		// i.e. goals was non empty but returns was entirely [undefined, undefined...].
		return [];
	}

	if (webhookEventContent.length !== 0 && goals[0]) {
		await EmitWebhookEvent({
			type: "goals-achieved/v1",
			content: { goals: webhookEventContent, userID, game: goals[0].game },
		});
	}

	await db["goal-subs"].bulkWrite(bulkWrite, { ordered: false });

	return importInfo;
}

/**
 * Calls EvaluateGoalForUser, then processes the returns into a bulkWrite
 * operation and an import statistic.
 * @returns undefined on error (i.e. EvaluateGoalForUser) OR if there's nothing
 * to say (i.e. user didnt raise the goal).
 */
export async function ProcessGoal(
	goal: GoalDocument,
	goalSub: GoalSubscriptionDocument,
	userID: integer,
	logger: KtLogger
) {
	const res = await EvaluateGoalForUser(goal, userID, logger);

	if (!res) {
		// some sort of error occured - its logged by the previous function.
		return;
	}

	// nothing has changed
	if (goalSub.progress === res.progress && goalSub.outOf === res.outOf) {
		return;
	}

	const newData = {
		progress: res.progress,
		progressHuman: res.progressHuman,
		outOf: res.outOf,
		outOfHuman: res.outOfHuman,
		achieved: res.achieved,
	};

	const oldData = {
		progress: goalSub.progress,
		progressHuman: goalSub.progressHuman,
		outOf: goalSub.outOf,
		outOfHuman: goalSub.outOfHuman,
		achieved: goalSub.achieved,
	};

	let webhookEvent = null;

	// if this is a newly-achieved goal

	if (res.achieved && !goalSub.achieved) {
		webhookEvent = {
			goalID: goal.goalID,
			old: oldData,
			new: newData,
			playtype: goal.playtype,
		};
	}

	let newTimeAchieved = null;

	if (newData.achieved) {
		// if this goal was just achieved
		if (goalSub.timeAchieved === null) {
			newTimeAchieved = Date.now();
		} else {
			// keep the old timestamp
			newTimeAchieved = goalSub.timeAchieved;
		}
	}

	// otherwise if this goal wasn't achieved then the timeAchieved is always null

	const setData = {
		...newData,
		timeAchieved: newTimeAchieved,

		// we're guaranteed that this works, because things
		// that haven't changed return nothing instead of
		// getting to this point.
		lastInteraction: Date.now(),
	} as unknown as Partial<GoalSubscriptionDocument>;

	// If this goal was achieved, and is now *not* achieved, we need to unset
	// some things.
	if (goalSub.achieved && !res.achieved) {
		logger.info(`User ${userID} lost their achieved status on ${goal.name}.`, {
			goal,
			res,
			goalSub,
		});

		// This goal can't be marked as instantly achieved, since it was lost.
		setData.wasInstantlyAchieved = false;
	}

	const bulkWrite = {
		updateOne: {
			filter: { goalID: goalSub.goalID, userID: goalSub.userID },
			update: {
				$set: setData,
			},
		},
	};

	return {
		bwrite: bulkWrite,
		import: {
			goalID: goal.goalID,
			old: oldData,
			new: newData,
		},
		webhookEvent,
	};
}

export async function UpdateGoalsInFolder(folderID: string, logger: KtLogger) {
	const goals = await db.goals.find({
		"charts.type": "folder",
		"charts.data": folderID,
	});

	logger.info(`Updating ${goals.length} goals for ${folderID}`);

	const goalSubs = await db["goal-subs"].find({
		goalID: { $in: goals.map((e) => e.goalID) },
	});

	logger.info(`Updating ${goalSubs.length} goal subs for ${folderID}`);

	// (User -> (goalID -> GoalSub))
	const ugsMap = new Map<integer, Map<string, GoalSubscriptionDocument>>();

	for (const gSub of goalSubs) {
		const userID = gSub.userID;

		if (ugsMap.has(userID)) {
			ugsMap.get(userID)!.set(gSub.goalID, gSub);
		} else {
			ugsMap.set(userID, new Map());
			ugsMap.get(userID)!.set(gSub.goalID, gSub);
		}
	}

	const promises = [];

	for (const [userID, goalSubsMap] of ugsMap.entries()) {
		promises.push(async () => {
			// hack: pass *all* goals here to avoid mass allocations
			// use `skipMismatch` to ignore the cases where they don't match
			await UpdateGoalsForUser(goals, goalSubsMap, userID, logger, true);
		});
	}

	await Promise.all(promises);
}
