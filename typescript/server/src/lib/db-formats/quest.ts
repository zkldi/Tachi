import { type Selection } from "kysely";
import { type Database } from "tachi-db";

export const SELECT_QUEST = [
	"quest.id",
	"quest.game",
	"quest.name",
	"quest.description",
	"quest.quest_data",
] as const;

export const SELECT_QUEST_SUB = [
	"quest_sub.quest_id",
	"quest_sub.user_id",
	"quest_sub.progress",
	"quest_sub.last_interaction",
	"quest_sub.achieved",
	"quest_sub.time_achieved",
	"quest_sub.was_instantly_achieved",
] as const;

/** `quest_sub` joined with `quest` for `quest.game` as `quest_game`. */
export const SELECT_QUEST_SUB_WITH_QUEST_GAME = [
	...SELECT_QUEST_SUB,
	"quest.game as quest_game",
] as const;

export type QuestRow = Selection<Database, "quest", (typeof SELECT_QUEST)[number]>;
export type QuestSubRow = Selection<Database, "quest_sub", (typeof SELECT_QUEST_SUB)[number]>;
export type QuestSubWithQuestGameRow = Selection<
	Database,
	"quest" | "quest_sub",
	(typeof SELECT_QUEST_SUB_WITH_QUEST_GAME)[number]
>;
