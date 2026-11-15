export function tableNameFor(collection: string): string {
	return collection.replace(/\.json$/u, "").replace(/-/gu, "_");
}

export type Flavour =
	| "bms-course-lookup"
	| "charts"
	| "folders"
	| "goals"
	| "questlines"
	| "quests"
	| "songs"
	| "tables";

export function flavourFor(collection: string): Flavour {
	if (collection.startsWith("songs-")) {
		return "songs";
	}
	if (collection.startsWith("charts-")) {
		return "charts";
	}
	if (collection === "folders.json") {
		return "folders";
	}
	if (collection === "goals.json") {
		return "goals";
	}
	if (collection === "quests.json") {
		return "quests";
	}
	if (collection === "questlines.json") {
		return "questlines";
	}
	if (collection === "tables.json") {
		return "tables";
	}
	if (collection === "bms-course-lookup.json") {
		return "bms-course-lookup";
	}
	throw new Error(`Unknown seeds collection flavour: ${collection}`);
}

export const FLAVOUR_COLUMNS: Record<Flavour, string[]> = {
	"bms-course-lookup": ["md5sums", "game", "set", "value", "title"],
	charts: [
		"id",
		"legacyChartID",
		"songID",
		"playtype",
		"difficulty",
		"level",
		"levelNum",
		"isPrimary",
		"versions",
	],
	folders: ["id", "legacyFolderID", "game", "playtype", "title", "table", "type", "inactive"],
	goals: ["goalID", "name", "criteria"],
	questlines: ["questlineID", "game", "playtype", "name"],
	quests: ["questID", "game", "playtype", "name"],
	songs: ["id", "title", "artist"],
	tables: [
		"id",
		"legacyTableID",
		"game",
		"playtype",
		"title",
		"default",
		"inactive",
		"description",
	],
};

export function ddlFor(collection: string): string {
	const tbl = tableNameFor(collection);
	const flav = flavourFor(collection);
	const cols = FLAVOUR_COLUMNS[flav];

	const primaryKeys = {
		"bms-course-lookup": "md5sums",
		charts: "id",
		folders: "id",
		goals: "goalID",
		questlines: "questlineID",
		quests: "questID",
		songs: "id",
		tables: "id",
	}[flav];

	const colDecls = cols
		.map((c) => {
			if (c === primaryKeys) {
				return `"${c}" PRIMARY KEY`;
			}
			if (c === "versions" || c === "criteria") {
				return `"${c}" TEXT`;
			} // JSON-as-text
			if (c === "isPrimary" || c === "inactive" || c === "default") {
				return `"${c}" INTEGER`;
			}
			if (c === "level" || c === "levelNum" || c === "value") {
				return `"${c}"`;
			}
			return `"${c}" TEXT`;
		})
		.join(", ");

	return `CREATE TABLE IF NOT EXISTS "${tbl}" (${colDecls}, "raw" TEXT NOT NULL);`;
}

export function indexesFor(collection: string): string[] {
	const tbl = tableNameFor(collection);
	const flav = flavourFor(collection);
	const idx: string[] = [];
	if (flav === "charts") {
		idx.push(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_songID" ON "${tbl}"("songID");`);
		idx.push(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_legacy" ON "${tbl}"("legacyChartID");`);
		idx.push(
			`CREATE INDEX IF NOT EXISTS "idx_${tbl}_playtype_diff" ON "${tbl}"("playtype","difficulty");`,
		);
		idx.push(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_level" ON "${tbl}"("levelNum");`);
	}
	if (flav === "songs") {
		idx.push(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_title" ON "${tbl}"("title");`);
	}
	if (flav === "folders" || flav === "tables" || flav === "quests" || flav === "questlines") {
		idx.push(
			`CREATE INDEX IF NOT EXISTS "idx_${tbl}_game_playtype" ON "${tbl}"("game","playtype");`,
		);
	}
	return idx;
}

export const META_DDL = `
CREATE TABLE IF NOT EXISTS "_meta" (
	"name" TEXT PRIMARY KEY,
	"content_hash" TEXT NOT NULL,
	"rows" INTEGER NOT NULL,
	"ingested_at" INTEGER NOT NULL
);
`;

export function projectRow(collection: string, row: Record<string, unknown>): unknown[] {
	const flav = flavourFor(collection);
	const cols = FLAVOUR_COLUMNS[flav];
	const values: unknown[] = [];
	for (const c of cols) {
		const v = row[c];
		if (Array.isArray(v) || (v !== null && typeof v === "object")) {
			values.push(JSON.stringify(v));
		} else if (typeof v === "boolean") {
			values.push(v ? 1 : 0);
		} else if (v === undefined) {
			values.push(null);
		} else {
			values.push(v);
		}
	}
	values.push(JSON.stringify(row));
	return values;
}

export function insertSqlFor(collection: string): string {
	const tbl = tableNameFor(collection);
	const flav = flavourFor(collection);
	const cols = FLAVOUR_COLUMNS[flav];
	const colList = [...cols, "raw"].map((c) => `"${c}"`).join(",");
	const placeholders = cols.map(() => "?").join(",");
	return `INSERT OR REPLACE INTO "${tbl}" (${colList}) VALUES (${placeholders}, ?)`;
}
