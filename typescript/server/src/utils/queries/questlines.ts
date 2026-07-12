import { SELECT_QUESTLINE, ToQuestlineDocument } from "#lib/db-formats/questline";
import DB from "#services/pg/db";
import { type QuestlineDocument, type V3Game } from "tachi-common";

/**
 * All questlines for a game, with `quests` ordered by `questline_quest.sort_order`.
 */
export async function GetQuestlinesForGame(game: V3Game): Promise<Array<QuestlineDocument>> {
	const qlRows = await DB.selectFrom("questline")
		.select(SELECT_QUESTLINE)
		.where("questline.game", "=", game)
		.execute();

	if (qlRows.length === 0) {
		return [];
	}

	const questlineIds = qlRows.map((r) => r.questline_id);

	const qqRows = await DB.selectFrom("questline_quest")
		.select([
			"questline_quest.questline_id",
			"questline_quest.quest_id",
			"questline_quest.sort_order",
		])
		.where("questline_quest.questline_id", "in", questlineIds)
		.orderBy("questline_quest.questline_id")
		.orderBy("questline_quest.sort_order")
		.execute();

	const byQuestline = new Map<string, Array<string>>();

	for (const row of qqRows) {
		const list = byQuestline.get(row.questline_id) ?? [];

		list.push(row.quest_id);
		byQuestline.set(row.questline_id, list);
	}

	return qlRows.map((row) => ToQuestlineDocument(row, byQuestline.get(row.questline_id) ?? []));
}

/**
 * All questlines that contain a given quest, with `quests` ordered by `sort_order`.
 */
export async function GetQuestlinesThatContainQuest(
	questID: string,
): Promise<Array<QuestlineDocument>> {
	const memberRows = await DB.selectFrom("questline_quest")
		.select("questline_quest.questline_id")
		.where("questline_quest.quest_id", "=", questID)
		.execute();

	if (memberRows.length === 0) {
		return [];
	}

	const questlineIds = memberRows.map((r) => r.questline_id);

	const qlRows = await DB.selectFrom("questline")
		.select(SELECT_QUESTLINE)
		.where("questline.id", "in", questlineIds)
		.execute();

	const qqRows = await DB.selectFrom("questline_quest")
		.select([
			"questline_quest.questline_id",
			"questline_quest.quest_id",
			"questline_quest.sort_order",
		])
		.where("questline_quest.questline_id", "in", questlineIds)
		.orderBy("questline_quest.questline_id")
		.orderBy("questline_quest.sort_order")
		.execute();

	const byQuestline = new Map<string, Array<string>>();

	for (const row of qqRows) {
		const list = byQuestline.get(row.questline_id) ?? [];

		list.push(row.quest_id);
		byQuestline.set(row.questline_id, list);
	}

	return qlRows.map((row) => ToQuestlineDocument(row, byQuestline.get(row.questline_id) ?? []));
}

/**
 * One questline by id, scoped to game. `quests` are ordered by `questline_quest.sort_order`.
 */
export async function GetQuestlineById(
	game: V3Game,
	questlineID: string,
): Promise<QuestlineDocument | undefined> {
	const row = await DB.selectFrom("questline")
		.select(SELECT_QUESTLINE)
		.where("questline.id", "=", questlineID)
		.where("questline.game", "=", game)
		.executeTakeFirst();

	if (!row) {
		return undefined;
	}

	const qqRows = await DB.selectFrom("questline_quest")
		.select("questline_quest.quest_id")
		.where("questline_quest.questline_id", "=", questlineID)
		.orderBy("questline_quest.sort_order")
		.execute();

	return ToQuestlineDocument(
		row,
		qqRows.map((r) => r.quest_id),
	);
}
