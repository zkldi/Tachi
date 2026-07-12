// Canonical SQL schema for the seeds SQLite db.
//
// Strategy: *per-collection* tables mirror the on-disk files exactly
// (so a row in `charts_iidx_sp` corresponds 1:1 to a JSON object in
// `db/seeds/charts-iidx-sp.json`). We project the scalar fields we
// query on into columns and keep the rest as a JSON blob - SQLite's
// `json_extract` makes that queryable when needed.
//
// Cross-cutting questions ("how many charts does iidx-sp have across all
// versions?") get answered by materialised views built over per-collection
// tables. We build the union of charts/songs lazily - i.e. the view DDL
// references every `charts_<game>` table that has been created.
//
// Table name convention: lowercase, '-' -> '_', strip '.json'.

export function tableNameFor(collection: string): string {
	return collection.replace(/\.json$/u, "").replace(/-/gu, "_");
}

// Schemas are table-flavoured: each collection maps to one of these.
//
//   "songs"   -> songs-*.json
//   "charts"  -> charts-*.json
//   "folders" -> folders.json
//   "goals"   -> goals.json
//   "quests"  -> quests.json
//   "questlines" -> questlines.json
//   "tables"  -> tables.json
//   "bms-course-lookup" -> bms-course-lookup.json
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

// Columns that each flavour exposes as real columns (everything else goes
// into the `raw` JSON blob). Chosen to cover the common queries:
// filter by game/playtype/difficulty/level, join song<->chart.
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

// DDL for per-collection tables. `raw` is the full JSON object; the rest are
// extracted scalar projections for indexing. Columns beyond `raw` are declared
// as `JSON` when they are arrays/objects (e.g. chart.versions, goal.criteria)
// and otherwise as TEXT/INTEGER as appropriate. SQLite doesn't care about
// declared types for storage, but having them helps readability.
export function ddlFor(collection: string): string {
	const tbl = tableNameFor(collection);
	const flav = flavourFor(collection);
	const cols = FLAVOUR_COLUMNS[flav];

	// Primary key per flavour.
	const pk = {
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
			if (c === pk) {
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

// Meta table tracks what we have ingested. Key is the collection filename,
// value is the sha256(prefix-16) of the JSON bytes.
export const META_DDL = `
CREATE TABLE IF NOT EXISTS "_meta" (
	"name" TEXT PRIMARY KEY,
	"content_hash" TEXT NOT NULL,
	"rows" INTEGER NOT NULL,
	"ingested_at" INTEGER NOT NULL
);
`;

// Row projection: given a JSON row and the flavour, produce the ordered values
// to bind to the INSERT (followed by the full JSON string as `raw`).
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
