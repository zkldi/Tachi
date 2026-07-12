import z from "zod";

import type {
	ChartDocumentData,
	Difficulties,
	GameGroup,
	SongDocumentData,
	V3Game,
	Versions,
} from "./game-config";
import type { DifficultyConfig } from "./game-config-utils";

import {
	ALL_GAMES,
	allSupportedGameGroups,
	GAME_GROUP_CONFIGS,
	GetSpecificGameConfig,
} from "../config/config";

/** Tachi seed row id: one-letter prefix + 19 lowercase hex digits. */
export function SEEDS_TachiIdSchema(prefix: string) {
	return z.string().regex(new RegExp(`^${prefix}[0-9a-f]{19}$`, "u"));
}

export const SEEDS_V3_GAME_SCHEMA = z.enum(ALL_GAMES as [V3Game, ...Array<V3Game>]);

export const SEEDS_V3_GAME_GROUP_SCHEMA = z.enum(
	allSupportedGameGroups as [GameGroup, ...Array<GameGroup>],
);

function difficultyZodSchema<G extends V3Game>(game: G): z.ZodType<Difficulties[G]> {
	const d = GetSpecificGameConfig(game).difficulties as DifficultyConfig;
	if (d.type === "DYNAMIC" || d.type === "CHUGEKIMAI_STYLE") {
		return z.string() as unknown as z.ZodType<Difficulties[G]>;
	}
	const order = d.order as ReadonlyArray<string>;
	return z.enum(order as [string, ...Array<string>]) as unknown as z.ZodType<Difficulties[G]>;
}

function versionsZodSchema<G extends V3Game>(game: G): z.ZodType<Array<Versions[G]>> {
	const versionKeys = Object.keys(GetSpecificGameConfig(game).versions);

	return z.array(z.string()).superRefine((val, ctx) => {
		if (versionKeys.length === 0) {
			if (val.length > 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "This game defines no chart versions; expected [].",
				});
			}
			return;
		}

		for (const v of val) {
			if (!versionKeys.includes(v)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Invalid version ${v}`,
				});
			}
		}

		if (new Set(val).size !== val.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Versions array shouldn't contain the same version twice",
			});
		}
	}) as unknown as z.ZodType<Array<Versions[G]>>;
}

function seedsChartDocumentSchemaForGame<G extends V3Game>(game: G) {
	const chartData = GetSpecificGameConfig(game).chartData as unknown as z.ZodType<
		ChartDocumentData[G]
	>;

	return z.strictObject({
		data: chartData,
		difficulty: difficultyZodSchema(game),
		id: SEEDS_TachiIdSchema("C"),
		isPrimary: z.boolean(),
		legacyChartID: z.string(),
		level: z.string(),
		levelNum: z.number(),
		songID: SEEDS_TachiIdSchema("S"),
		versions: versionsZodSchema(game),
	}) as unknown as z.ZodType<{
		data: ChartDocumentData[G];
		difficulty: Difficulties[G];
		id: string;
		isPrimary: boolean;
		legacyChartID: string;
		level: string;
		levelNum: number;
		songID: string;
		versions: Array<Versions[G]>;
	}>;
}

/** One schema per `charts-${game}.json` collection. */
export const SEEDS_CHART_DOCUMENT_SCHEMAS = Object.fromEntries(
	ALL_GAMES.map((game) => [game, seedsChartDocumentSchemaForGame(game)]),
) as {
	readonly [G in V3Game]: ReturnType<typeof seedsChartDocumentSchemaForGame<G>>;
};

export type SEEDS_ChartDocument<TGame extends V3Game = V3Game> = z.infer<
	(typeof SEEDS_CHART_DOCUMENT_SCHEMAS)[TGame]
>;

function seedsSongDocumentSchemaForGroup<G extends GameGroup>(group: G) {
	const songData = GAME_GROUP_CONFIGS[group].songData as unknown as z.ZodType<
		SongDocumentData[G]
	>;

	return z.strictObject({
		altTitles: z.array(z.string()),
		artist: z.string(),
		data: songData,
		id: SEEDS_TachiIdSchema("S"),
		legacySongID: z.number(),
		searchTerms: z.array(z.string()),
		title: z.string(),
	}) as unknown as z.ZodType<{
		altTitles: Array<string>;
		artist: string;
		data: SongDocumentData[G];
		id: string;
		legacySongID: number;
		searchTerms: Array<string>;
		title: string;
	}>;
}

/** One schema per `songs-${gameGroup}.json` collection. */
export const SEEDS_SONG_DOCUMENT_SCHEMAS = Object.fromEntries(
	allSupportedGameGroups.map((group) => [group, seedsSongDocumentSchemaForGroup(group)]),
) as {
	readonly [G in GameGroup]: ReturnType<typeof seedsSongDocumentSchemaForGroup<G>>;
};

export type SEEDS_SongDocument<G extends GameGroup = GameGroup> = z.infer<
	(typeof SEEDS_SONG_DOCUMENT_SCHEMAS)[G]
>;

export const SEEDS_BMS_COURSE_DOCUMENT_SCHEMA = z.strictObject({
	game: z.enum(["bms-14k", "bms-7k", "pms-controller", "pms-keyboard"]),
	md5sums: z.string(),
	set: z.string(),
	title: z.string(),
	value: z.string(),
});

export type SEEDS_BMSCourseDocument = z.infer<typeof SEEDS_BMS_COURSE_DOCUMENT_SCHEMA>;

export const SEEDS_TABLE_DOCUMENT_SCHEMA = z.strictObject({
	default: z.boolean(),
	description: z.string(),
	folders: z.array(z.string()),
	game: SEEDS_V3_GAME_SCHEMA,
	id: SEEDS_TachiIdSchema("T"),
	inactive: z.boolean(),
	legacyTableID: z.string(),
	slug: z.string().optional(),
	title: z.string(),
});

export type SEEDS_TableDocument = z.infer<typeof SEEDS_TABLE_DOCUMENT_SCHEMA>;

const seedsQuestGoalRefSchema = z.strictObject({
	goalID: z.string(),
	note: z.string().optional(),
});

const seedsQuestSectionSchema = z.strictObject({
	desc: z.string().optional(),
	goals: z.array(seedsQuestGoalRefSchema),
	title: z.string(),
});

export const SEEDS_QUEST_DOCUMENT_SCHEMA = z.strictObject({
	desc: z.string(),
	game: SEEDS_V3_GAME_SCHEMA,
	name: z.string(),
	questData: z.array(seedsQuestSectionSchema),
	questID: z.string(),
});

export type SEEDS_QuestDocument = z.infer<typeof SEEDS_QUEST_DOCUMENT_SCHEMA>;

export const SEEDS_QUESTLINE_DOCUMENT_SCHEMA = z.strictObject({
	desc: z.string(),
	game: SEEDS_V3_GAME_SCHEMA,
	name: z.string(),
	questlineID: z.string(),
	quests: z.array(z.string()),
});

export type SEEDS_QuestlineDocument = z.infer<typeof SEEDS_QUESTLINE_DOCUMENT_SCHEMA>;

/** Row shape in `folders.json` seed collections. */
export const SEEDS_FOLDER_DOCUMENT_SCHEMA = z.strictObject({
	game: SEEDS_V3_GAME_SCHEMA,
	id: SEEDS_TachiIdSchema("F"),
	inactive: z.boolean(),
	legacyFolderID: z.string(),
	searchTerms: z.array(z.string()),
	slug: z.string(),
	title: z.string(),
	versionFilter: z.array(z.string()).optional(),
	where: z.string(),
});

export type SEEDS_FolderDocument = z.infer<typeof SEEDS_FOLDER_DOCUMENT_SCHEMA>;

const SEEDS_GOAL_CRITERIA_SCHEMA = z.union([
	z.strictObject({
		countNum: z.number(),
		key: z.string(),
		mode: z.union([z.literal("absolute"), z.literal("proportion")]),
		source: z.enum(["score", "calculated"]).optional(),
		value: z.number(),
	}),
	z.strictObject({
		key: z.string(),
		mode: z.literal("single"),
		source: z.enum(["score", "calculated"]).optional(),
		value: z.number(),
	}),
]);

const SEEDS_GOAL_CHARTS_SCHEMA = z.discriminatedUnion("type", [
	z.strictObject({
		data: z.string(),
		folderSlug: z.string().optional(),
		type: z.literal("folder"),
	}),
	z.strictObject({
		data: z.array(z.string()),
		type: z.literal("multi"),
	}),
	z.strictObject({
		data: z.string(),
		type: z.literal("single"),
	}),
]);

export const SEEDS_GOAL_DOCUMENT_SCHEMA = z.strictObject({
	charts: SEEDS_GOAL_CHARTS_SCHEMA,
	criteria: SEEDS_GOAL_CRITERIA_SCHEMA,
	game: SEEDS_V3_GAME_SCHEMA,
	goalID: z.string(),
	name: z.string(),
});

export type SEEDS_GoalDocument = z.infer<typeof SEEDS_GOAL_DOCUMENT_SCHEMA>;
