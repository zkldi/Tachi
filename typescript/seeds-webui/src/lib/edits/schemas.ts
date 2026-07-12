// Resolve a zod schema for a seeds collection by filename.
//
// Collections are named after the on-disk files in db/seeds/, e.g.
// `charts-iidx-sp.json`, `songs-iidx.json`, `folders.json`. Charts are
// per-game and songs are per-game-group, so we parse the filename to pick
// the right schema out of the per-game maps in tachi-common.
//
// If no schema is known for a collection (or the parsed game isn't in the
// maps), returns null. The caller should fall back to a raw-JSON editor.

import type { z } from "zod";

import {
	SEEDS_BMS_COURSE_DOCUMENT_SCHEMA,
	SEEDS_CHART_DOCUMENT_SCHEMAS,
	SEEDS_FOLDER_DOCUMENT_SCHEMA,
	SEEDS_GOAL_DOCUMENT_SCHEMA,
	SEEDS_QUEST_DOCUMENT_SCHEMA,
	SEEDS_QUESTLINE_DOCUMENT_SCHEMA,
	SEEDS_SONG_DOCUMENT_SCHEMAS,
	SEEDS_TABLE_DOCUMENT_SCHEMA,
} from "tachi-common/types/seeds-documents-zod";

export function schemaForCollection(name: string): z.ZodType<unknown> | null {
	const stripped = name.replace(/\.json$/u, "");

	if (stripped === "folders") {
		return SEEDS_FOLDER_DOCUMENT_SCHEMA as z.ZodType<unknown>;
	}
	if (stripped === "tables") {
		return SEEDS_TABLE_DOCUMENT_SCHEMA as z.ZodType<unknown>;
	}
	if (stripped === "goals") {
		return SEEDS_GOAL_DOCUMENT_SCHEMA as z.ZodType<unknown>;
	}
	if (stripped === "quests") {
		return SEEDS_QUEST_DOCUMENT_SCHEMA as z.ZodType<unknown>;
	}
	if (stripped === "questlines") {
		return SEEDS_QUESTLINE_DOCUMENT_SCHEMA as z.ZodType<unknown>;
	}
	if (stripped === "bms-course-lookup") {
		return SEEDS_BMS_COURSE_DOCUMENT_SCHEMA as z.ZodType<unknown>;
	}

	// charts-${V3Game}.json - filenames mirror `db/seeds/` and match ALL_GAMES
	// keys (e.g. iidx-sp, bms-14k, gitadora-dora). Do not split on the last
	// hyphen; that would turn iidx-sp into iidx and miss the schema map.
	if (stripped.startsWith("charts-")) {
		const game = stripped.slice("charts-".length);
		const schemas = SEEDS_CHART_DOCUMENT_SCHEMAS as Record<string, z.ZodType<unknown>>;
		return schemas[game] ?? null;
	}

	// songs-${gameGroup}.json
	if (stripped.startsWith("songs-")) {
		const group = stripped.slice("songs-".length);
		const schemas = SEEDS_SONG_DOCUMENT_SCHEMAS as Record<string, z.ZodType<unknown>>;
		return schemas[group] ?? null;
	}

	return null;
}
