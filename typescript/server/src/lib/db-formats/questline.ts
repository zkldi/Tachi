import { type Selection } from "kysely";
import { type QuestlineDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_QUESTLINE = [
	"questline.id as questline_id",
	"questline.game as questline_game",
	"questline.name as questline_name",
	"questline.description as questline_description",
] as const;

/** Unaliased columns for joins where the API maps `questline.*` fields directly. */
export const SELECT_QUESTLINE_ROW = [
	"questline.id",
	"questline.game",
	"questline.name",
	"questline.description",
] as const;

export type QuestlineRow = Selection<Database, "questline", (typeof SELECT_QUESTLINE)[number]>;

export function ToQuestlineDocument(
	row: QuestlineRow,
	questIdsOrdered: Array<string>,
): QuestlineDocument {
	return {
		questlineID: row.questline_id,
		name: row.questline_name,
		desc: row.questline_description,
		game: row.questline_game,
		quests: questIdsOrdered,
	};
}
