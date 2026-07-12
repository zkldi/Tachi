import type { integer } from "tachi-common";

import { SELECT_FOLDER, ToFolderDocument } from "#lib/db-formats/folders";
import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { SELECT_SESSION_DOCUMENT, ToSessionDocument } from "#lib/db-formats/session";
import {
	AttachFolderSlugsToGoals,
	ToGoalDocument,
	ToGoalSubscriptionDocument,
} from "#lib/db-formats/target-documents";
import DB from "#services/pg/db";
import { GetEnumDistForFolders } from "#utils/folder";
import { GetTimeXHoursAgo } from "#utils/misc";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { sql } from "kysely";

const REASONABLE_HOURS_AGO = 16;

export async function GetRecentPlaycount(userID: integer) {
	const time = GetTimeXHoursAgo(REASONABLE_HOURS_AGO);

	const row = await DB.selectFrom("score")
		.select(sql<number>`count(*)::int`.as("c"))
		.where("user_id", "=", userID)
		.where("time_achieved", ">=", UnixMillisecondsToISO8601(time))
		.executeTakeFirst();

	return Number(row?.c ?? 0);
}

export async function GetRecentSessions(userID: integer) {
	const time = GetTimeXHoursAgo(REASONABLE_HOURS_AGO);

	const sessionRows = await DB.selectFrom("session")
		.select(SELECT_SESSION_DOCUMENT)
		.where("user_id", "=", userID)
		.where("time_ended", ">=", UnixMillisecondsToISO8601(time))
		.execute();

	if (sessionRows.length === 0) {
		return [];
	}

	const sessionIds = sessionRows.map((s) => s.id);

	const scoreRows = await DB.selectFrom("score")
		.select(["session_id", "id"])
		.where("session_id", "in", sessionIds)
		.execute();

	const scoresBySession = new Map<string, Array<string>>();

	for (const s of scoreRows) {
		if (!s.session_id) {
			continue;
		}

		const arr = scoresBySession.get(s.session_id) ?? [];

		arr.push(s.id);
		scoresBySession.set(s.session_id, arr);
	}

	return sessionRows.map((row) => ToSessionDocument(row, scoresBySession.get(row.id) ?? []));
}

export async function GetRecentlyViewedFoldersAnyGame(userID: integer) {
	const time = GetTimeXHoursAgo(REASONABLE_HOURS_AGO);

	const rows = await DB.selectFrom("folder_view")
		.innerJoin("folder", "folder.id", "folder_view.folder_id")
		.select(SELECT_FOLDER)
		.where("folder_view.user_id", "=", userID)
		.where("folder_view.last_viewed", ">=", UnixMillisecondsToISO8601(time))
		.orderBy("folder_view.last_viewed", "desc")
		.limit(4)
		.execute();

	const folders = rows.map(ToFolderDocument);

	const stats = await GetEnumDistForFolders(userID, folders);

	return { folders, stats };
}

export async function GetGoalSummary(userID: integer) {
	const time = GetTimeXHoursAgo(REASONABLE_HOURS_AGO);
	const timeIso = UnixMillisecondsToISO8601(time);

	const achievedRows = await DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.user_id", "=", userID)
		.where("goal_sub.time_achieved", ">=", timeIso)
		.where("goal_sub.was_instantly_achieved", "=", false)
		.execute();

	const improvedRows = await DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.user_id", "=", userID)
		.where("goal_sub.last_interaction", ">=", timeIso)
		.where("goal_sub.achieved", "=", false)
		.execute();

	const achievedGoals = achievedRows.map((r) => ToGoalSubscriptionDocument(r));

	const improvedGoals = improvedRows.map((r) => ToGoalSubscriptionDocument(r));

	const goalIds = [...new Set([...achievedGoals, ...improvedGoals].map((e) => e.goalID))];

	const goalRows =
		goalIds.length === 0
			? []
			: await DB.selectFrom("goal")
					.select(SELECT_GOAL)
					.where("goal.id", "in", goalIds)
					.execute();

	const goals = goalRows.map(ToGoalDocument);
	await AttachFolderSlugsToGoals(goals);

	return { achievedGoals, improvedGoals, goals };
}
