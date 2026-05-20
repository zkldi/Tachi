import type { Game } from "tachi-db";

import { GetChartsByIds, SELECT_CHART, ToChartDocument } from "#lib/db-formats/chart";
import { LoadFolderDocumentById } from "#lib/db-formats/folders";
import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { SELECT_QUEST, SELECT_QUEST_SUB_WITH_QUEST_GAME } from "#lib/db-formats/quest";
import { GetSongsByIDs as GetSongsByIDs } from "#lib/db-formats/song";
import {
	AttachFolderSlugsToGoals,
	ToGoalDocument,
	ToGoalSubscriptionDocument,
	ToQuestDocument,
	ToQuestSubscriptionDocument,
} from "#lib/db-formats/target-documents";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { type ExpressionBuilder, sql } from "kysely";
import {
	FormatChart,
	type GameGroup,
	type GoalDocument,
	type integer,
	LEGACY_GameGroupPTToGame,
	type LEGACY_Playtype,
	type PBScoreDocument,
	type QuestDocument,
	type QuestlineDocument,
	type ScoreDocument,
} from "tachi-common";

type MsTimeRange =
	| number
	| { $gt?: number; $gte?: number; $lt?: number; $lte?: number; $ne?: null };

type UserIDFilter = integer | { $in: Array<integer> };

interface TargetSubFilter {
	game?: GameGroup;
	playtype?: LEGACY_Playtype;
	userID?: UserIDFilter;
	timeAchieved?: MsTimeRange;
	lastInteraction?: MsTimeRange;
}

function applyMsTimeOnColumn(
	column:
		| "goal_sub.last_interaction"
		| "goal_sub.time_achieved"
		| "quest_sub.last_interaction"
		| "quest_sub.time_achieved",
	filter: MsTimeRange | undefined,
) {
	if (filter === undefined) {
		return undefined;
	}

	if (typeof filter === "number") {
		return (eb: ExpressionBuilder<any, any>) =>
			eb(column, "=", UnixMillisecondsToISO8601(filter));
	}

	const f = filter as {
		$gt?: number;
		$gte?: number;
		$lt?: number;
		$lte?: number;
		$ne?: null;
	};

	return (eb: ExpressionBuilder<any, any>) => {
		const parts = [];

		if (f.$gte !== undefined) {
			parts.push(eb(column, ">=", UnixMillisecondsToISO8601(f.$gte)));
		}

		if (f.$lte !== undefined) {
			parts.push(eb(column, "<=", UnixMillisecondsToISO8601(f.$lte)));
		}

		if (f.$lt !== undefined) {
			parts.push(eb(column, "<", UnixMillisecondsToISO8601(f.$lt)));
		}

		if (f.$gt !== undefined) {
			parts.push(eb(column, ">", UnixMillisecondsToISO8601(f.$gt)));
		}

		if (f.$ne === null) {
			parts.push(eb(column, "is not", null));
		}

		if (parts.length === 0) {
			return sql<boolean>`true`;
		}

		return eb.and(parts);
	};
}

function whereUserIdOnGoalSub(userID: UserIDFilter | undefined) {
	if (userID === undefined) {
		return undefined;
	}

	if (typeof userID === "number") {
		return (eb: any) => eb("goal_sub.user_id", "=", userID);
	}

	const ids = userID.$in;

	if (ids.length === 0) {
		return () => sql`false`;
	}

	return (eb: any) => eb("goal_sub.user_id", "in", ids);
}

function whereUserIdOnQuestSub(userID: UserIDFilter | undefined) {
	if (userID === undefined) {
		return undefined;
	}

	if (typeof userID === "number") {
		return (eb: any) => eb("quest_sub.user_id", "=", userID);
	}

	const ids = userID.$in;

	if (ids.length === 0) {
		return () => sql`false`;
	}

	return (eb: any) => eb("quest_sub.user_id", "in", ids);
}

/**
 * Next numeric `song.legacy_id` for BMS/PMS - `max(existing) + 1`, or `1` if none.
 * Replaces Mongo `counters` `*-song-id` documents.
 *
 * This shit sucks and should be dropped asap: TODO(zk)
 */
export async function GetNextBmsPmsSongLegacyId(game: "bms" | "pms"): Promise<integer> {
	const row = await DB.selectFrom("song")
		.select(sql<number>`coalesce(max(song.legacy_id), 0)::int`.as("m"))
		.where("game_group", "=", game)
		.executeTakeFirst();

	return (row?.m ?? 0) + 1;
}

export async function GetRelevantSongsAndCharts(scores: Array<PBScoreDocument | ScoreDocument>) {
	const songIDs = [...new Set(scores.map((e) => e.songID))];
	const chartIDs = [...new Set(scores.map((e) => e.chartID))];

	const [songs, charts] = await Promise.all([GetSongsByIDs(songIDs), GetChartsByIds(chartIDs)]);

	return { songs, charts };
}

export async function GetChartForIDGuaranteed(chartID: string) {
	const row = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "=", chartID)
		.executeTakeFirst();

	if (!row) {
		throw new Error(`Couldn't find chart with ID ${chartID}.`);
	}

	return ToChartDocument(row);
}

export async function GetSongForIDGuaranteed(songID: string) {
	const res = await GetSongsByIDs([songID]);

	const song = res[0];

	if (!song) {
		throw new Error(`Couldn't find song with ID ${songID}.`);
	}

	return song;
}

export function GetFolder(folderID: string) {
	return LoadFolderDocumentById(folderID).then((doc) => doc ?? null);
}

export async function GetFolderForIDGuaranteed(folderID: string) {
	const folder = await GetFolder(folderID);

	if (!folder) {
		throw new Error(`Couldn't find folder with ID ${folderID}.`);
	}

	return folder;
}

export async function GetGoalForIDGuaranteed(goalID: string) {
	const row = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", "=", goalID)
		.executeTakeFirst();

	if (!row) {
		throw new Error(`Couldn't find goal with ID ${goalID}`);
	}

	const goal = ToGoalDocument(row);
	await AttachFolderSlugsToGoals([goal]);

	return goal;
}

export async function GetGoalSubscriptionForIDGuaranteed(goalID: string, userID: integer) {
	const row = await DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.goal_id", "=", goalID)
		.where("goal_sub.user_id", "=", userID)
		.executeTakeFirst();

	if (!row) {
		throw new Error(
			`Couldn't find goal subscription with goalID ${goalID} and userID ${userID}`,
		);
	}

	return ToGoalSubscriptionDocument(row);
}

export async function GetQuestForIDGuaranteed(questID: string) {
	const row = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "=", questID)
		.executeTakeFirst();

	if (!row) {
		throw new Error(`Couldn't find quest with ID ${questID}`);
	}

	return ToQuestDocument(row);
}

export async function HumaniseChartID(chartID: string) {
	const chart = await GetChartForIDGuaranteed(chartID);

	return FormatChart(chart);
}

/**
 * Get recently achieved goals for this query.
 *
 * @param baseQuery - A base query, used to limit results on GPTs or UGPTs.
 * @param limit - How many recently achieved goals to search for. `0` means no limit.
 * @returns - The goals and their subs.
 */
export async function GetRecentlyAchievedGoals(
	{ game, playtype, userID, timeAchieved, lastInteraction }: TargetSubFilter,
	limit = 100,
) {
	let q = DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.was_instantly_achieved", "=", false)
		.where("goal_sub.achieved", "=", true);

	const uidFn = whereUserIdOnGoalSub(userID);

	if (uidFn) {
		q = q.where(uidFn);
	}

	if (game !== undefined && playtype !== undefined) {
		q = q.where("goal.game", "=", LEGACY_GameGroupPTToGame(game, playtype) as Game);
	}

	const taFn = applyMsTimeOnColumn("goal_sub.time_achieved", timeAchieved);

	if (taFn) {
		q = q.where(taFn);
	}

	const liFn = applyMsTimeOnColumn("goal_sub.last_interaction", lastInteraction);

	if (liFn) {
		q = q.where(liFn);
	}

	q = q.orderBy("goal_sub.time_achieved", "desc");

	if (limit > 0) {
		q = q.limit(limit);
	}

	const goalSubRows = await q.execute();

	const goalSubs = goalSubRows.map((r) => ToGoalSubscriptionDocument(r));

	const goalIds = [...new Set(goalSubs.map((g) => g.goalID))];

	const goalRows =
		goalIds.length === 0
			? []
			: await DB.selectFrom("goal")
					.select(SELECT_GOAL)
					.where("goal.id", "in", goalIds)
					.execute();

	const goals = goalRows.map(ToGoalDocument);
	await AttachFolderSlugsToGoals(goals);

	return { goals, goalSubs };
}

export async function GetRecentlyInteractedGoals(
	{ game, playtype, userID, timeAchieved, lastInteraction }: TargetSubFilter,
	limit = 100,
) {
	let q = DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.was_instantly_achieved", "=", false)
		.where("goal_sub.achieved", "=", false)
		.where("goal_sub.last_interaction", "is not", null);

	const uidFn = whereUserIdOnGoalSub(userID);

	if (uidFn) {
		q = q.where(uidFn);
	}

	if (game !== undefined && playtype !== undefined) {
		q = q.where("goal.game", "=", LEGACY_GameGroupPTToGame(game, playtype) as Game);
	}

	const taFn = applyMsTimeOnColumn("goal_sub.time_achieved", timeAchieved);

	if (taFn) {
		q = q.where(taFn);
	}

	const liFn = applyMsTimeOnColumn("goal_sub.last_interaction", lastInteraction);

	if (liFn) {
		q = q.where(liFn);
	}

	q = q.orderBy("goal_sub.last_interaction", "desc");

	if (limit > 0) {
		q = q.limit(limit);
	}

	const goalSubRows = await q.execute();

	const goalSubs = goalSubRows.map((r) => ToGoalSubscriptionDocument(r));

	const goalIds = [...new Set(goalSubs.map((g) => g.goalID))];

	const goalRows =
		goalIds.length === 0
			? []
			: await DB.selectFrom("goal")
					.select(SELECT_GOAL)
					.where("goal.id", "in", goalIds)
					.execute();

	const goals = goalRows.map(ToGoalDocument);
	await AttachFolderSlugsToGoals(goals);

	return { goals, goalSubs };
}

export async function GetRecentlyAchievedQuests(
	{ game, playtype, userID, timeAchieved, lastInteraction }: TargetSubFilter,
	limit = 100,
) {
	let q = DB.selectFrom("quest_sub")
		.innerJoin("quest", "quest.id", "quest_sub.quest_id")
		.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
		.where("quest_sub.was_instantly_achieved", "=", false)
		.where("quest_sub.achieved", "=", true);

	const uidFn = whereUserIdOnQuestSub(userID);

	if (uidFn) {
		q = q.where(uidFn);
	}

	if (game !== undefined && playtype !== undefined) {
		q = q.where("quest.game", "=", LEGACY_GameGroupPTToGame(game, playtype) as Game);
	}

	const taFn = applyMsTimeOnColumn("quest_sub.time_achieved", timeAchieved);

	if (taFn) {
		q = q.where(taFn);
	}

	const liFn = applyMsTimeOnColumn("quest_sub.last_interaction", lastInteraction);

	if (liFn) {
		q = q.where(liFn);
	}

	q = q.orderBy("quest_sub.time_achieved", "desc");

	if (limit > 0) {
		q = q.limit(limit);
	}

	const questSubRows = await q.execute();

	const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));

	const questIds = [...new Set(questSubs.map((s) => s.questID))];

	const questRows =
		questIds.length === 0
			? []
			: await DB.selectFrom("quest")
					.select(SELECT_QUEST)
					.where("quest.id", "in", questIds)
					.execute();

	const quests = questRows.map(ToQuestDocument);

	return { quests, questSubs };
}

export async function GetRecentlyInteractedQuests(
	{ game, playtype, userID, timeAchieved, lastInteraction }: TargetSubFilter,
	limit = 100,
) {
	let q = DB.selectFrom("quest_sub")
		.innerJoin("quest", "quest.id", "quest_sub.quest_id")
		.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
		.where("quest_sub.last_interaction", "is not", null)
		.where("quest_sub.achieved", "=", false)
		.where("quest_sub.was_instantly_achieved", "=", false);

	const uidFn = whereUserIdOnQuestSub(userID);

	if (uidFn) {
		q = q.where(uidFn);
	}

	if (game !== undefined && playtype !== undefined) {
		q = q.where("quest.game", "=", LEGACY_GameGroupPTToGame(game, playtype) as Game);
	}

	const taFn = applyMsTimeOnColumn("quest_sub.time_achieved", timeAchieved);

	if (taFn) {
		q = q.where(taFn);
	}

	const liFn = applyMsTimeOnColumn("quest_sub.last_interaction", lastInteraction);

	if (liFn) {
		q = q.where(liFn);
	}

	q = q.orderBy("quest_sub.last_interaction", "desc");

	if (limit > 0) {
		q = q.limit(limit);
	}

	const questSubRows = await q.execute();

	const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));

	const questIds = [...new Set(questSubs.map((s) => s.questID))];

	const questRows =
		questIds.length === 0
			? []
			: await DB.selectFrom("quest")
					.select(SELECT_QUEST)
					.where("quest.id", "in", questIds)
					.execute();

	const quests = questRows.map(ToQuestDocument);

	return { quests, questSubs };
}

function whereUserIdOnGoalSubForAggregate(userID: UserIDFilter | undefined) {
	if (userID === undefined) {
		return undefined;
	}

	if (typeof userID === "number") {
		return (eb: any) => eb("goal_sub.user_id", "=", userID);
	}

	const ids = userID.$in;

	if (ids.length === 0) {
		return () => sql`false`;
	}

	return (eb: any) => eb("goal_sub.user_id", "in", ids);
}

export async function GetMostSubscribedGoals(
	{ game, playtype, userID }: TargetSubFilter,
	limit = 100,
): Promise<Array<{ __subscriptions: integer } & GoalDocument>> {
	let q = DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select("goal_sub.goal_id")
		.select(sql<number>`count(*)::int`.as("subscriptions"))
		.groupBy("goal_sub.goal_id");

	const uidFn = whereUserIdOnGoalSubForAggregate(userID);

	if (uidFn) {
		q = q.where(uidFn);
	}

	if (game !== undefined && playtype !== undefined) {
		q = q.where("goal.game", "=", LEGACY_GameGroupPTToGame(game, playtype) as Game);
	}

	const ranked = await q.orderBy("subscriptions", "desc").limit(limit).execute();

	const goalIds = ranked.map((r) => r.goal_id);

	if (goalIds.length === 0) {
		return [];
	}

	const goalRows = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", "in", goalIds)
		.execute();

	const byId = new Map(goalRows.map((g) => [g.id, g]));

	return ranked
		.map((r) => {
			const g = byId.get(r.goal_id);

			if (!g) {
				return null;
			}

			return {
				__subscriptions: r.subscriptions,
				...ToGoalDocument(g),
			};
		})
		.filter((e): e is { __subscriptions: integer } & GoalDocument => e !== null);
}

export async function GetMostSubscribedQuests(
	{ game, playtype }: TargetSubFilter,
	limit = 100,
): Promise<Array<{ __subscriptions: integer } & QuestDocument>> {
	let q = DB.selectFrom("quest")
		.innerJoin("quest_sub", "quest_sub.quest_id", "quest.id")
		.select("quest.id")
		.select(sql<number>`count(*)::int`.as("subscriptions"))
		.groupBy("quest.id");

	if (game !== undefined && playtype !== undefined) {
		q = q.where("quest.game", "=", LEGACY_GameGroupPTToGame(game, playtype) as Game);
	}

	const ranked = await q.orderBy("subscriptions", "desc").limit(limit).execute();

	const questIds = ranked.map((r) => r.id);

	if (questIds.length === 0) {
		return [];
	}

	const questRows = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "in", questIds)
		.execute();

	const byId = new Map(questRows.map((x) => [x.id, x]));

	return ranked
		.map((r) => {
			const x = byId.get(r.id);

			if (!x) {
				return null;
			}

			return {
				__subscriptions: r.subscriptions,
				...ToQuestDocument(x),
			};
		})
		.filter((e): e is { __subscriptions: integer } & QuestDocument => e !== null);
}

export async function GetChildQuests(questline: QuestlineDocument) {
	if (questline.quests.length === 0) {
		return [];
	}

	const quests = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "in", questline.quests)
		.execute();

	if (quests.length !== questline.quests.length) {
		log.warn(
			{ questline },
			`Expected to find ${questline.quests.length} quests in the database, but only found ${quests.length}.`,
		);
	}

	const byId = new Map(quests.map((q) => [q.id, q]));

	return questline.quests
		.map((id) => byId.get(id))
		.filter((q): q is NonNullable<typeof q> => q !== undefined)
		.map(ToQuestDocument);
}
