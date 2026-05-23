import {
	ALL_GAMES,
	type ChartDocument,
	GAME_GROUP_CONFIGS,
	GameToGameGroup,
	type SEEDS_BMSCourseDocument,
	type SEEDS_ChartDocument,
	type SEEDS_FolderDocument,
	type SEEDS_GoalDocument,
	type SEEDS_QuestDocument,
	type SEEDS_QuestlineDocument,
	type SEEDS_SongDocument,
	type SEEDS_TableDocument,
	type V3Game,
} from "tachi-common";
/* eslint-disable no-await-in-loop */
import type {
	Database,
	GameGroup,
	NewBmsCourseLookup,
	NewChart,
	NewFolder,
	NewGoal,
	NewQuest,
	NewQuestline,
	NewQuestlineQuest,
	NewSong,
	NewTable,
	NewTableFolder,
	Game as PgGame,
} from "tachi-db";

import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import { rebuildFolderChartLookup } from "#lib/folders/rebuild-folder-chart-lookup";
import { log } from "#lib/log/log";
import fs from "fs";
import { type Insertable, type Kysely, type RawBuilder, sql } from "kysely";
import path from "path";

/**
 * Maps a `game` field from seeds JSON (always a canonical V3Game, e.g. "iidx-sp") to the
 * Postgres `game` enum. Run `just seeds-v3-migrate` if legacy shapes appear in repo seeds.
 */
function seedJsonGameToPg(game: string, label: string): PgGame {
	if ((ALL_GAMES as readonly string[]).includes(game)) {
		return game as PgGame;
	}

	throw new Error(
		`[seeds] ${label}: unrecognised game ${JSON.stringify(game)}. Expected a V3Game string.`,
	);
}

const INSERT_CHUNK = 500;

/** Maps `game\\0slug` → folder id for resolving `tables.json` folder refs. */
function buildFolderGameSlugToIdMap(folders: Array<SEEDS_FolderDocument>): Map<string, string> {
	const m = new Map<string, string>();

	for (const f of folders) {
		const key = `${f.game}\0${f.slug}`;

		if (m.has(key)) {
			throw new Error(
				`Duplicate folder slug ${JSON.stringify(f.slug)} for game ${JSON.stringify(f.game)}`,
			);
		}

		m.set(key, f.id);
	}

	return m;
}

function readSeedFile<T>(seedsDir: string, filename: string): Array<T> {
	return JSON.parse(fs.readFileSync(path.join(seedsDir, filename), "utf-8")) as Array<T>;
}

async function batchInsertOnConflictDoNothing<T extends keyof Database>(
	pg: Kysely<Database>,
	table: T,
	rows: ReadonlyArray<Insertable<Database[T]>>,
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
		const chunk = rows.slice(i, i + INSERT_CHUNK);

		await pg
			.insertInto(table)
			.values(chunk as never)
			.onConflict((oc) => oc.doNothing())
			.execute();
	}
}

/**
 * Deletes rows from a seed-owned table where the id column is NOT in keepIds.
 * Pass a scope (`{ column, value }`) to restrict deletion to a specific
 * game/game_group so that rows belonging to non-seed-covered games are untouched.
 * Uses `= ANY($1::text[])` to send keepIds as a single array parameter rather than
 * generating a huge `NOT IN (…)` list.
 *
 * Returns the number of rows deleted.
 */
async function deleteSeedStale(
	db: Kysely<Database>,
	table: keyof Database,
	idColumn: string,
	keepIds: ReadonlyArray<string>,
	scope?: { column: string; value: string },
): Promise<bigint> {
	let q = db.deleteFrom(table as never) as any;

	if (scope !== undefined) {
		q = q.where(scope.column, "=", scope.value);
	}

	const result = await q
		.where(sql`NOT (${sql.ref(idColumn)} = ANY(${sql.val(keepIds)}::text[]))`)
		.executeTakeFirst();

	return BigInt(result?.numDeletedRows ?? 0);
}

/** Returns true if the error is a Postgres foreign-key violation (code 23503). */
function isForeignKeyViolation(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		(err as { code: unknown }).code === "23503"
	);
}

/**
 * Re-throws a FK violation as a friendlier error that names the seed table being
 * cleaned up and includes the Postgres detail string.
 */
function throwFriendlyFkError(table: string, err: unknown): never {
	const detail =
		typeof err === "object" && err !== null && "detail" in err
			? String((err as { detail: unknown }).detail)
			: String(err);

	throw new Error(
		`Seeds apply blocked: cannot delete stale rows from "${table}" because user data still references them.\n` +
			`Postgres detail: ${detail}\n` +
			`(Roll back the seed change that removed those rows, or delete the referencing user data first.)`,
	);
}

export type ImportSeedsSubsetOptions = {
	gameGroups: GameGroup[];
	/** When true (default), load chart rows whose `songID` is in the loaded song set. */
	includeCharts?: boolean;
	maxSongsPerGame: number;
};

/**
 * Loads a bounded slice of real seed JSON (songs + optional charts) for tests or tooling.
 */
export async function ImportSeedsSubsetForTests(
	pg: Kysely<Database>,
	seedsDir: string,
	options: ImportSeedsSubsetOptions,
): Promise<void> {
	const { maxSongsPerGame, gameGroups, includeCharts = true } = options;
	const loadedSongIds = new Set<string>();

	for (const gg of gameGroups) {
		const filename = `songs-${gg}.json`;
		const filepath = path.join(seedsDir, filename);

		if (!fs.existsSync(filepath)) {
			throw new Error(`seed file not found: ${filepath}`);
		}

		const all = readSeedFile<SEEDS_SongDocument>(seedsDir, filename);
		const songs = all.slice(0, maxSongsPerGame);
		const songRows: Array<NewSong> = [];

		for (const s of songs) {
			songRows.push({
				id: s.id,
				legacy_id: s.legacySongID,
				game_group: gg,
				title: s.title,
				artist: s.artist,
				search_terms: s.searchTerms,
				alt_titles: s.altTitles,
				data: JSON.stringify(s.data),
				fts_document: [...s.searchTerms, ...s.altTitles].filter(Boolean).join(" "),
			});

			loadedSongIds.add(s.id);
		}

		for (let i = 0; i < songRows.length; i = i + INSERT_CHUNK) {
			const rows = songRows.slice(i, i + INSERT_CHUNK);

			await pg
				.insertInto("song")
				.values(rows)
				.onConflict((oc) => oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})))
				.execute();
		}
	}

	if (!includeCharts) {
		return;
	}

	const chartFiles = fs
		.readdirSync(seedsDir)
		.filter((f) => f.startsWith("charts-") && f.endsWith(".json"));

	for (const gg of gameGroups) {
		const filesForGame = chartFiles.filter((f) => f.startsWith(`charts-${gg}`));

		for (const file of filesForGame) {
			const game = file.replace(/^charts-/u, "").replace(/\.json$/u, "") as V3Game;
			const charts = readSeedFile<SEEDS_ChartDocument>(seedsDir, file).filter((c) =>
				loadedSongIds.has(c.songID),
			);

			if (charts.length === 0) {
				continue;
			}

			const chartRows: Array<NewChart> = charts.map((c) => ({
				id: c.id,
				legacy_id: c.legacyChartID,
				game,
				song_id: c.songID,
				level: c.level,
				level_num: c.levelNum,
				is_primary: c.isPrimary,
				difficulty: c.difficulty,
				versions: c.versions.map(String),
				data: JSON.stringify(c.data),
				derivation_checksum: ComputeChartStabilityChecksum(
					game,
					c as unknown as ChartDocument,
				),
			}));

			for (let i = 0; i < chartRows.length; i = i + INSERT_CHUNK) {
				const rows = chartRows.slice(i, i + INSERT_CHUNK);

				await pg
					.insertInto("chart")
					.values(rows)
					.onConflict((oc) =>
						oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}
		}
	}
}

// ── Chart ID map ───────────────────────────────────────────────────────────

/**
 * Reads all chart seed files and returns a map of old MongoDB chartID (40-char
 * SHA1 hex) → new hex id. Used by the migration script to translate chart_id
 * FK references in scores and PBs.
 */
export function buildChartIdMap(seedsDir: string): Map<string, string> {
	const map = new Map<string, string>();

	const chartFiles = fs
		.readdirSync(seedsDir)
		.filter((f) => f.startsWith("charts-") && f.endsWith(".json"));

	for (const file of chartFiles) {
		const charts = JSON.parse(fs.readFileSync(path.join(seedsDir, file), "utf-8")) as Array<{
			id: string;
			legacyChartID?: string;
		}>;

		for (const c of charts) {
			if (c.legacyChartID && c.id) {
				map.set(c.legacyChartID, c.id);
			}
		}
	}

	return map;
}

/**
 * Optional `goals` map in `typescript/seeds-scripts/rerunners/v3/stability-map.json`
 * (written by `7-remap-goals-folder-and-chart-ids.ts`). Mongo `goal-subs.goalID` may
 * still use hashes from before legacy chart/folder ids were rewired.
 */
export function buildGoalIdRemap(seedsDir: string): Map<string, string> {
	const p = path.resolve(
		seedsDir,
		"..",
		"..",
		"typescript",
		"seeds-scripts",
		"rerunners",
		"v3",
		"stability-map.json",
	);

	if (!fs.existsSync(p)) {
		return new Map();
	}

	const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as { goals?: Record<string, string> };
	const goals = raw.goals;

	if (goals === undefined) {
		return new Map();
	}

	return new Map(Object.entries(goals));
}

// ── Core import logic ──────────────────────────────────────────────────────

export async function importSeeds(pg: Kysely<Database>, seedsDir: string): Promise<void> {
	// Games whose charts originate on the server (via IR uploads) and are backsynced to seeds —
	// never delete their rows during import, since the seeds may be behind the DB.
	const dynamicGameGroups = new Set(
		(Object.entries(GAME_GROUP_CONFIGS) as Array<[string, { dynamicContent: boolean }]>)
			.filter(([, config]) => config.dynamicContent)
			.map(([group]) => group),
	);

	const files = new Set<string>(fs.readdirSync(seedsDir));
	const songFiles = [...files].filter((f) => f.startsWith("songs-") && f.endsWith(".json"));
	const chartFiles = [...files].filter((f) => f.startsWith("charts-") && f.endsWith(".json"));

	await pg.transaction().execute(async (txn) => {
		// for each collection
		// upsert data (add new rows and update rows that have changed)
		// then delete all rows that have been removed (rare, rows should basically never be removed)

		// ── Phase 1: Upsert ────────────────────────────────────────────────

		// songs
		const songIdsByGroup: Array<{ gameGroup: GameGroup; ids: Array<string> }> = [];
		{
			log.info("[song]");
			let total = 0;

			for (const file of songFiles) {
				const gameGroup = file.replace(/^songs-/u, "").replace(/\.json$/u, "") as GameGroup;
				const seeds = readSeedFile<SEEDS_SongDocument>(seedsDir, file);
				const rows: Array<NewSong> = [];

				for (const s of seeds) {
					rows.push({
						id: s.id,
						legacy_id: s.legacySongID,
						game_group: gameGroup,
						title: s.title,
						artist: s.artist,
						search_terms: s.searchTerms,
						alt_titles: s.altTitles,
						data: JSON.stringify(s.data),
						fts_document: [...s.searchTerms, ...s.altTitles].filter(Boolean).join(" "),
					});
				}

				for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
					await txn
						.insertInto("song")
						.values(rows.slice(i, i + INSERT_CHUNK))
						.onConflict((oc) =>
							oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
						)
						.execute();
				}

				songIdsByGroup.push({ gameGroup, ids: rows.map((r) => r.id) });
				total = total + rows.length;
				log.info(`  ${gameGroup}: ${rows.length} songs`);
				// rows goes out of scope here; GC can reclaim it
			}

			log.info(`  Total: ${total}\n`);
		}

		// charts
		const chartIdsByGame: Array<{ game: PgGame; ids: Array<string> }> = [];
		{
			log.info("[chart]");
			let total = 0;

			for (const file of chartFiles) {
				const game = file.replace(/^charts-/u, "").replace(/\.json$/u, "") as PgGame;
				const seeds = readSeedFile<SEEDS_ChartDocument>(seedsDir, file);

				if (seeds.length === 0) {
					continue;
				}

				const rows: Array<NewChart> = [];

				for (const c of seeds) {
					rows.push({
						id: c.id,
						legacy_id: c.legacyChartID,
						game,
						song_id: c.songID,
						level: c.level,
						level_num: c.levelNum,
						is_primary: c.isPrimary,
						difficulty: c.difficulty,
						versions: c.versions.map(String),
						data: JSON.stringify(c.data),
						derivation_checksum: ComputeChartStabilityChecksum(
							game,
							c as unknown as ChartDocument,
						),
					});
				}

				for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
					await txn
						.insertInto("chart")
						.values(rows.slice(i, i + INSERT_CHUNK))
						.onConflict((oc) =>
							oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
						)
						.execute();
				}

				chartIdsByGame.push({ game, ids: rows.map((r) => r.id) });
				total = total + rows.length;
				log.info(`  ${game}: ${rows.length} charts`);
				// rows goes out of scope here; GC can reclaim it
			}

			log.info(`  Total: ${total}\n`);
		}

		// folders
		// folderSlugToId is kept for the tables block below.
		let folderIds: Array<string>;
		let folderSlugToId: Map<string, string>;
		let folderCount: number;
		{
			log.info("[folder]");
			const seeds = readSeedFile<SEEDS_FolderDocument>(seedsDir, "folders.json");
			folderSlugToId = buildFolderGameSlugToIdMap(seeds);
			const rows: Array<NewFolder> = seeds.map((f) => ({
				id: f.id,
				legacy_id: f.legacyFolderID,
				game: f.game as PgGame,
				inactive: f.inactive,
				title: f.title,
				slug: f.slug,
				where: f.where,
				version_filter:
					f.versionFilter && f.versionFilter.length > 0 ? f.versionFilter : null,
				search_terms: f.searchTerms,
			}));

			for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
				await txn
					.insertInto("folder")
					.values(rows.slice(i, i + INSERT_CHUNK))
					.onConflict((oc) =>
						oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}

			folderIds = rows.map((r) => r.id);
			folderCount = rows.length;
			log.info(`  ${folderCount} folders\n`);
			// seeds and rows go out of scope here
		}

		// tables — preclear default_value for seeded games first so the deferrable
		// exclusion constraint `one_default_table_per_game` is never transiently
		// violated when moving the default between tables. (Alternatively:
		// SET CONSTRAINTS one_default_table_per_game DEFERRED for this transaction.)
		let tableIds: Array<string>;
		let tfRows: Array<NewTableFolder>;
		let tableCount: number;
		{
			log.info("[table / table_folder]");
			const seeds = readSeedFile<SEEDS_TableDocument>(seedsDir, "tables.json");
			const rows: Array<NewTable> = seeds.map((t) => ({
				id: t.id,
				legacy_id: t.legacyTableID,
				game: t.game as PgGame,
				inactive: t.inactive,
				title: t.title,
				default_value: t.default,
			}));

			tfRows = seeds.flatMap((t) =>
				t.folders.map((folderSlug, ordering) => {
					const folderId = folderSlugToId.get(`${t.game}\0${folderSlug}`);

					if (folderId === undefined) {
						throw new Error(
							`Table "${t.title}" (${t.id}): unknown folder slug ${folderSlug} for game ${t.game}`,
						);
					}

					return { table_id: t.id, folder_id: folderId, ordering };
				}),
			);

			const gamesInSeeds = [...new Set(rows.map((r) => r.game))];

			if (gamesInSeeds.length > 0) {
				await txn
					.updateTable("table")
					.set({ default_value: false })
					.where("table.game", "in", gamesInSeeds)
					.execute();
			}

			for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
				await txn
					.insertInto("table")
					.values(rows.slice(i, i + INSERT_CHUNK))
					.onConflict((oc) =>
						oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}

			tableIds = rows.map((r) => r.id);
			tableCount = rows.length;
			// seeds, rows, and folderSlugToId go out of scope here
		}

		// bms_course_lookup
		let courseMd5sums: Array<string>;
		{
			log.info("[bms_course_lookup]");
			const seeds = readSeedFile<SEEDS_BMSCourseDocument>(seedsDir, "bms-course-lookup.json");
			const rows: Array<NewBmsCourseLookup> = seeds.map((c) => ({
				md5sums: c.md5sums,
				title: c.title,
				set: c.set as string,
				game: c.game as PgGame,
				value: c.value as string,
			}));

			for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
				await txn
					.insertInto("bms_course_lookup")
					.values(rows.slice(i, i + INSERT_CHUNK))
					.onConflict((oc) =>
						oc.column("md5sums").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}

			courseMd5sums = rows.map((r) => r.md5sums);
			log.info(`  ${rows.length} BMS courses\n`);
		}

		// goals — upsert so seed edits (renamed goals, updated criteria) are applied
		{
			log.info("[goal]");
			const seeds = readSeedFile<SEEDS_GoalDocument>(seedsDir, "goals.json");
			const rows: Array<NewGoal> = seeds.map((g) => ({
				id: g.goalID,
				game: seedJsonGameToPg(g.game, `goal ${g.goalID}`),
				name: g.name,
				charts: JSON.stringify(g.charts),
				criteria: JSON.stringify(g.criteria),
			}));

			for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
				await txn
					.insertInto("goal")
					.values(rows.slice(i, i + INSERT_CHUNK))
					.onConflict((oc) =>
						oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}

			log.info(`  ${rows.length} goals\n`);
		}

		// quests
		let questIds: Array<string>;
		{
			log.info("[quest]");
			const seeds = readSeedFile<SEEDS_QuestDocument>(seedsDir, "quests.json");
			const rows: Array<NewQuest> = seeds.map((q) => ({
				id: q.questID,
				game: seedJsonGameToPg(q.game, `quest ${q.questID}`),
				name: q.name,
				description: q.desc,
				quest_data: JSON.stringify(q.questData),
			}));

			for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
				await txn
					.insertInto("quest")
					.values(rows.slice(i, i + INSERT_CHUNK))
					.onConflict((oc) =>
						oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}

			questIds = rows.map((r) => r.id);
			log.info(`  ${rows.length} quests\n`);
		}

		// questlines
		let questlineIds: Array<string>;
		let qlqRows: Array<NewQuestlineQuest>;
		let qlCount: number;
		{
			log.info("[questline / questline_quest]");
			const seeds = readSeedFile<SEEDS_QuestlineDocument>(seedsDir, "questlines.json");
			const rows: Array<NewQuestline> = seeds.map((ql) => ({
				id: ql.questlineID,
				game: seedJsonGameToPg(ql.game, `questline ${ql.questlineID}`),
				name: ql.name,
				description: ql.desc,
			}));

			let order = 0;

			qlqRows = seeds.flatMap((ql) => {
				order = 0;

				return ql.quests.map((questId) => ({
					questline_id: ql.questlineID,
					quest_id: questId,
					sort_order: order++,
				}));
			});

			for (let i = 0; i < rows.length; i = i + INSERT_CHUNK) {
				await txn
					.insertInto("questline")
					.values(rows.slice(i, i + INSERT_CHUNK))
					.onConflict((oc) =>
						oc.column("id").doUpdateSet(OnConflictSetAll(rows[0] ?? {})),
					)
					.execute();
			}

			questlineIds = rows.map((r) => r.id);
			qlCount = rows.length;
			// seeds and rows go out of scope here
		}

		// ── Phase 2: Full-replace seed-only junction tables ────────────────
		// These tables are derived purely from seeds — delete everything and
		// reinsert from seeds so the DB matches the files exactly.

		await txn.deleteFrom("table_folder").execute();
		await batchInsertOnConflictDoNothing(txn, "table_folder", tfRows);
		log.info(`  ${tableCount} tables, ${tfRows.length} table-folder rows\n`);

		await txn.deleteFrom("questline_quest").execute();
		await batchInsertOnConflictDoNothing(txn, "questline_quest", qlqRows);
		log.info(`  ${qlCount} questlines, ${qlqRows.length} questline-quest rows\n`);

		// ── Phase 3: Delete stale seed rows (dependency order) ─────────────
		// Junction tables are already clean (phase 2). User-data FKs
		// (score→chart, pb→chart, goal_sub→goal, etc.) intentionally block
		// deletion — the error surfaces via throwFriendlyFkError below.
		//
		// Deletion order: children before parents.
		//   table → folder → chart → song → quest → questline → bms
		// (goal rows are not pruned — goals removed from seeds are left in DB.)

		log.info("[stale-delete]");

		// "table" — no user FKs; table_folder already cleared
		{
			const n = await deleteSeedStale(txn, "table", "table.id", tableIds);

			if (n > 0n) {
				log.info(`  removed ${n} stale table(s)`);
			}
		}

		// folder — folder_chart_lookup cascades; folder_view blocks (intentional)
		try {
			const n = await deleteSeedStale(txn, "folder", "folder.id", folderIds);

			if (n > 0n) {
				log.info(`  removed ${n} stale folder(s)`);
			}
		} catch (err) {
			if (isForeignKeyViolation(err)) {
				throwFriendlyFkError("folder", err);
			}

			throw err;
		}

		// chart — folder_chart_lookup cascades; score/pb block (intentional)
		for (const { game, ids } of chartIdsByGame) {
			if (dynamicGameGroups.has(GameToGameGroup(game as V3Game))) {
				log.info(`  skipping stale-delete for dynamic-content game ${game}`);
				continue;
			}

			try {
				const n = await deleteSeedStale(txn, "chart", "chart.id", ids, {
					column: "chart.game",
					value: game,
				});

				if (n > 0n) {
					log.info(`  removed ${n} stale chart(s) [${game}]`);
				}
			} catch (err) {
				if (isForeignKeyViolation(err)) {
					throwFriendlyFkError("chart", err);
				}

				throw err;
			}
		}

		// song — chart blocks (intentional)
		for (const { gameGroup, ids } of songIdsByGroup) {
			if (dynamicGameGroups.has(gameGroup as GameGroup)) {
				log.info(`  skipping stale-delete for dynamic-content game group ${gameGroup}`);
				continue;
			}

			try {
				const n = await deleteSeedStale(txn, "song", "song.id", ids, {
					column: "song.game_group",
					value: gameGroup,
				});

				if (n > 0n) {
					log.info(`  removed ${n} stale song(s) [${gameGroup}]`);
				}
			} catch (err) {
				if (isForeignKeyViolation(err)) {
					throwFriendlyFkError("song", err);
				}

				throw err;
			}
		}

		// quest — quest_sub / import_quest block (intentional); questline_quest cleared
		try {
			const n = await deleteSeedStale(txn, "quest", "quest.id", questIds);

			if (n > 0n) {
				log.info(`  removed ${n} stale quest(s)`);
			}
		} catch (err) {
			if (isForeignKeyViolation(err)) {
				throwFriendlyFkError("quest", err);
			}

			throw err;
		}

		// questline — questline_quest cleared; no user FKs
		{
			const n = await deleteSeedStale(txn, "questline", "questline.id", questlineIds);

			if (n > 0n) {
				log.info(`  removed ${n} stale questline(s)`);
			}
		}

		// bms_course_lookup — PK is md5sums (not id); no referencing FKs
		{
			const n = await deleteSeedStale(
				txn,
				"bms_course_lookup",
				"bms_course_lookup.md5sums",
				courseMd5sums,
			);

			if (n > 0n) {
				log.info(`  removed ${n} stale BMS course(s)`);
			}
		}

		// ── Phase 4: Rebuild folder_chart_lookup ───────────────────────────
		// Full DELETE + reinsert cache derived from folder SQL predicates.
		// Rows for deleted folders/charts are already gone via ON DELETE CASCADE,
		// but we do a full rebuild anyway to keep the cache consistent.
		log.info("[folder_chart_lookup]");
		const lookupStats = await rebuildFolderChartLookup(txn);

		log.info(`  ${lookupStats.folderCount} folders, ${lookupStats.rowCount} lookup rows\n`);
	});
}

// look at what you're inserting. for all fields, generate ON CONFLICT DO UPDATE (all fields) = excluded.(all fields)
function OnConflictSetAll(exampleRow: Record<string, unknown>) {
	const toSet: Record<string, RawBuilder<unknown>> = {};

	for (const key of Object.keys(exampleRow)) {
		toSet[key] = sql`excluded.${sql.ref(key)}`;
	}

	return toSet;
}
