import type { GameGroup, V3Game } from "../types";
import type {
	SEEDS_BMSCourseDocument,
	SEEDS_ChartDocument,
	SEEDS_FolderDocument,
	SEEDS_GoalDocument,
	SEEDS_QuestDocument,
	SEEDS_QuestlineDocument,
	SEEDS_SongDocument,
	SEEDS_TableDocument,
} from "../types/seeds-documents";

import { allSupportedGameGroups } from "../config/config";

// lazy, but kinda cool macros.
// note that TS won't let you do this multiple times within an object
// so, we have to join them ourselves. Ah well, not that bad.
type ChartDBSeeds = {
	[TGame in V3Game as `charts-${TGame}.json`]: Array<SEEDS_ChartDocument<TGame>>;
};

type SongDBSeeds = {
	[G in GameGroup as `songs-${G}.json`]: Array<SEEDS_SongDocument<G>>;
};

interface OtherDBSeeds {
	"bms-course-lookup.json": Array<SEEDS_BMSCourseDocument>;
	"folders.json": Array<SEEDS_FolderDocument>;
	"goals.json": Array<SEEDS_GoalDocument>;
	"questlines.json": Array<SEEDS_QuestlineDocument>;
	"quests.json": Array<SEEDS_QuestDocument>;
	"tables.json": Array<SEEDS_TableDocument>;
}

export type AllDatabaseSeeds = ChartDBSeeds & OtherDBSeeds & SongDBSeeds;

// Nifty trick to enforce that we always specify all database seeds :)
const CURRENT_DATABASE_SEEDS: Record<keyof OtherDBSeeds, true> = {
	"bms-course-lookup.json": true,
	"folders.json": true,
	"goals.json": true,
	"questlines.json": true,
	"quests.json": true,
	"tables.json": true,
};

const moreOnes: Array<string> = [];

for (const game of allSupportedGameGroups) {
	moreOnes.push(`songs-${game}.json`, `charts-${game}.json`);
}

export const DatabaseSeedNames = [...Object.keys(CURRENT_DATABASE_SEEDS), ...moreOnes] as Array<
	keyof AllDatabaseSeeds
>;
