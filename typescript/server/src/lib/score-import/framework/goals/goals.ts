import type { KtLogger } from "#lib/log/log";

import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { ToGoalDocument, ToGoalSubscriptionDocument } from "#lib/db-formats/target-documents";
import { EvaluateGoalForUser, GetRelevantGoals } from "#lib/targets/goals";
import { EmitWebhookEvent } from "#lib/webhooks/webhooks";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { sql } from "kysely";
import {
	type GoalDocument,
	type GoalSubscriptionDocument,
	type integer,
	type V3Game,
} from "tachi-common";

/**
 * Update a user's progress on all of their set goals.
 */
export async function GetAndUpdateUsersGoals(
	game: V3Game,
	userID: integer,
	chartIDs: Set<string>,
	log: KtLogger,
) {
	const { goals, goalSubsMap } = await GetRelevantGoals(game, userID, chartIDs, log);

	if (!goals.length) {
		return [];
	}

	log.debug(`Found ${goals.length} relevant goals.`);

	return UpdateGoalsForUser(goals, goalSubsMap, userID, log);
}

export async function UpdateGoalsForUser(
	goals: Array<GoalDocument>,
	goalSubsMap: Map<string, GoalSubscriptionDocument>,
	userID: integer,
	log: KtLogger,
	skipMismatch = false,
) {
	const returns = await Promise.all(
		goals.map((goal: GoalDocument) => {
			const goalSub = goalSubsMap.get(goal.goalID);

			if (!goalSub) {
				if (skipMismatch) {
					return null;
				}

				log.error(
					`UserGoal:GoalID mismatch ${goal.goalID} - this user has no goalSub for this, yet it is set.`,
				);

				return null;
			}

			return ProcessGoal(goal, goalSub, userID, log).catch((err: Error) => {
				log.warn(
					{ goal, err, userID, goalSub },
					`Failed to process goal '${goal.name}' for ${userID}, ${err.message}. Skipping.`,
				);

				return null;
			});
		}),
	);

	const importInfo = [];
	const webhookEventContent = [];

	for (const ret of returns) {
		if (!ret) {
			continue;
		}

		importInfo.push(ret.import);

		if (ret.pgUpdate) {
			await DB.updateTable("goal_sub")
				.set(ret.pgUpdate.set)
				.where("goal_sub.goal_id", "=", ret.pgUpdate.goalId)
				.where("goal_sub.user_id", "=", ret.pgUpdate.userId)
				.execute();
		}

		if (ret.webhookEvent) {
			webhookEventContent.push(ret.webhookEvent);
		}
	}

	if (importInfo.length === 0) {
		return [];
	}

	if (webhookEventContent.length !== 0 && goals[0]) {
		await EmitWebhookEvent({
			type: "goals-achieved/v1",
			content: {
				goals: webhookEventContent,
				userID,
				game: goals[0].game,
			},
		});
	}

	return importInfo;
}

/**
 * Calls EvaluateGoalForUser, then processes the returns into a Postgres update
 * and an import statistic.
 * @returns undefined on error (i.e. EvaluateGoalForUser) OR if there's nothing
 * to say (i.e. user didnt raise the goal).
 */
export async function ProcessGoal(
	goal: GoalDocument,
	goalSub: GoalSubscriptionDocument,
	userID: integer,
	log: KtLogger,
) {
	const res = await EvaluateGoalForUser(goal, userID, log);

	if (!res) {
		return;
	}

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

	if (res.achieved && !goalSub.achieved) {
		webhookEvent = {
			goalID: goal.goalID,
			old: oldData,
			new: newData,
			game: goal.game,
		};
	}

	let newTimeAchievedMs: number | null = null;

	if (newData.achieved) {
		if (goalSub.timeAchieved === null) {
			newTimeAchievedMs = Date.now();
		} else {
			newTimeAchievedMs = goalSub.timeAchieved;
		}
	}

	const lastInteractionIso = UnixMillisecondsToISO8601(Date.now());

	let wasInstantlyAchieved = goalSub.wasInstantlyAchieved;

	if (goalSub.achieved && !res.achieved) {
		log.info(
			{
				goal,
				res,
				goalSub,
			},
			`User ${userID} lost their achieved status on ${goal.name}.`,
		);

		wasInstantlyAchieved = false;
	}

	const setPayload = {
		progress: newData.progress,
		progress_human: newData.progressHuman,
		out_of: newData.outOf,
		out_of_human: newData.outOfHuman,
		achieved: newData.achieved,
		time_achieved: newData.achieved
			? newTimeAchievedMs !== null
				? UnixMillisecondsToISO8601(newTimeAchievedMs)
				: null
			: null,
		last_interaction: lastInteractionIso,
		was_instantly_achieved: wasInstantlyAchieved,
	};

	return {
		pgUpdate: {
			goalId: goalSub.goalID,
			userId: goalSub.userID,
			set: setPayload,
		},
		import: {
			goalID: goal.goalID,
			old: oldData,
			new: newData,
		},
		webhookEvent,
	};
}

export async function UpdateGoalsInFolder(folderID: string, log: KtLogger) {
	const goalRows = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where(sql`goal.charts->>'type'`, "=", "folder")
		.where(sql`goal.charts->>'data'`, "=", folderID)
		.execute();

	const goals = goalRows.map(ToGoalDocument);

	log.info(`Updating ${goals.length} goals for ${folderID}`);

	const goalIds = goals.map((g) => g.goalID);

	if (goalIds.length === 0) {
		return;
	}

	const subRows = await DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.goal_id", "in", goalIds)
		.execute();

	log.info(`Updating ${subRows.length} goal subs for ${folderID}`);

	const goalSubs = subRows.map((r) => ToGoalSubscriptionDocument(r));

	const ugsMap = new Map<integer, Map<string, GoalSubscriptionDocument>>();

	for (const gSub of goalSubs) {
		const uid = gSub.userID;

		if (ugsMap.has(uid)) {
			ugsMap.get(uid)!.set(gSub.goalID, gSub);
		} else {
			ugsMap.set(uid, new Map());
			ugsMap.get(uid)!.set(gSub.goalID, gSub);
		}
	}

	await Promise.all(
		[...ugsMap.entries()].map(([uid, goalSubsMap]) =>
			UpdateGoalsForUser(goals, goalSubsMap, uid, log, true),
		),
	);
}
