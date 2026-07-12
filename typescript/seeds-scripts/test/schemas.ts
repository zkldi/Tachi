import {
	ALL_GAMES,
	allSupportedGameGroups,
	type GameGroup,
	SEEDS_BMS_COURSE_DOCUMENT_SCHEMA,
	SEEDS_CHART_DOCUMENT_SCHEMAS,
	SEEDS_FOLDER_DOCUMENT_SCHEMA,
	SEEDS_GOAL_DOCUMENT_SCHEMA,
	SEEDS_QUEST_DOCUMENT_SCHEMA,
	SEEDS_QUESTLINE_DOCUMENT_SCHEMA,
	SEEDS_SONG_DOCUMENT_SCHEMAS,
	SEEDS_TABLE_DOCUMENT_SCHEMA,
	type V3Game,
} from "tachi-common";
import { type ZodType } from "zod";

export type AllCollections =
	| "bms-course-lookup.json"
	| "folders.json"
	| "goals.json"
	| "questlines.json"
	| "quests.json"
	| "tables.json"
	| `charts-${V3Game}.json`
	| `songs-${GameGroup}.json`;

/** @deprecated Use {@link SEEDS_CHART_DOCUMENT_SCHEMAS} from tachi-common. */
export const V3_CHART_SCHEMAS = Object.fromEntries(
	ALL_GAMES.map((game) => [`charts-${game}.json` as const, SEEDS_CHART_DOCUMENT_SCHEMAS[game]]),
) as Record<`charts-${V3Game}.json`, ZodType>;

/** @deprecated Use {@link SEEDS_SONG_DOCUMENT_SCHEMAS} from tachi-common. */
export const V3_SONG_SCHEMAS = Object.fromEntries(
	allSupportedGameGroups.map((g) => [`songs-${g}.json` as const, SEEDS_SONG_DOCUMENT_SCHEMAS[g]]),
) as Record<`songs-${GameGroup}.json`, ZodType>;

export const V3_SCHEMAS: Record<AllCollections, ZodType> = {
	"bms-course-lookup.json": SEEDS_BMS_COURSE_DOCUMENT_SCHEMA,
	"folders.json": SEEDS_FOLDER_DOCUMENT_SCHEMA,
	"goals.json": SEEDS_GOAL_DOCUMENT_SCHEMA,
	"questlines.json": SEEDS_QUESTLINE_DOCUMENT_SCHEMA,
	"quests.json": SEEDS_QUEST_DOCUMENT_SCHEMA,
	"tables.json": SEEDS_TABLE_DOCUMENT_SCHEMA,
	...V3_SONG_SCHEMAS,
	...V3_CHART_SCHEMAS,
};
