import type { TableDocument } from "tachi-common";

import { LoadTableDocumentByLegacyId } from "#lib/db-formats/table";
import {
	BuildFolderQuery,
	GetFoldersFromTable,
	GetTableForIDGuaranteed,
} from "#lib/folders/folders";
import DB from "#services/pg/db";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * `BuildFolderQuery` loads `folder.where` and splices it into
 * `SELECT chart.id FROM chart INNER JOIN song s … WHERE <query>`, optionally
 * AND-ing overlap on `chart.versions` when `version_filter` is set. The column
 * must hold a SQL predicate (no leading `WHERE`), e.g. `chart.level_num = 10`.
 */
describe("BuildFolderQuery", () => {
	function ids(prefix: string) {
		const u = randomUUID().replace(/-/gu, "").slice(0, 12);

		return {
			folderId: `${prefix}-f-${u}`,
			folderLegacy: `${prefix}-fl-${u}`,
			songId: `${prefix}-s-${u}`,
			chartA: `${prefix}-ca-${u}`,
			chartB: `${prefix}-cb-${u}`,
		};
	}

	it("throws when the folder id does not exist", async () => {
		await expect(BuildFolderQuery("F_missing_folder_id")).rejects.toThrow(
			"Folder with ID 'F_missing_folder_id' not found.",
		);
	});

	it("fails at execute time when folder.where is not valid SQL (e.g. JSON)", async () => {
		const { folderId, folderLegacy } = ids("bfq0");

		await DB.insertInto("folder")
			.values({
				id: folderId,
				legacy_id: folderLegacy,
				game: "iidx-sp",
				inactive: false,
				title: "JSON query column",
				slug: folderId,
				where: JSON.stringify({ type: "charts", data: { level: "10" } }),
				version_filter: null,
				search_terms: [],
			})
			.execute();

		const { folderQuery } = await BuildFolderQuery(folderId);

		await expect(folderQuery.execute(DB)).rejects.toThrow();
	});

	it("returns chart rows that satisfy the stored SQL predicate", async () => {
		const { folderId, folderLegacy, songId, chartA, chartB } = ids("bfq1");

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 9_800_001,
				game_group: "iidx",
				title: "BFQ Song",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: chartA,
					legacy_id: chartA,
					game: "iidx-sp",
					song_id: songId,
					level: "9",
					level_num: 9,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({}),
				},
				{
					id: chartB,
					legacy_id: chartB,
					game: "iidx-sp",
					song_id: songId,
					level: "10",
					level_num: 10,
					is_primary: true,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({}),
				},
			])
			.execute();

		await DB.insertInto("folder")
			.values({
				id: folderId,
				legacy_id: folderLegacy,
				game: "iidx-sp",
				inactive: false,
				title: "BFQ level 10 only",
				slug: folderId,
				where: "chart.level_num = 10",
				version_filter: null,
				search_terms: [],
			})
			.execute();

		const { folderQuery: built } = await BuildFolderQuery(folderId);
		const { rows } = await built.execute(DB);

		expect(rows).toHaveLength(1);
		expect((rows[0] as { id: string }).id).toBe(chartB);
	});

	it("wraps folder.where so OR does not bypass chart.game (and version_filter) ANDs", async () => {
		const { folderId, folderLegacy, songId, chartA, chartB } = ids("bfq-or");
		const otherGameChart = `${chartA}-other`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 9_800_010,
				game_group: "iidx",
				title: "OR precedence song",
				artist: "Z",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values([
				{
					id: chartA,
					legacy_id: chartA,
					game: "iidx-sp",
					song_id: songId,
					level: "9",
					level_num: 9,
					is_primary: true,
					difficulty: "NORMAL",
					versions: ["epolis"],
					data: JSON.stringify({}),
				},
				{
					id: chartB,
					legacy_id: chartB,
					game: "iidx-sp",
					song_id: songId,
					level: "10",
					level_num: 10,
					is_primary: true,
					difficulty: "HYPER",
					versions: ["epolis"],
					data: JSON.stringify({}),
				},
				{
					id: otherGameChart,
					legacy_id: otherGameChart,
					game: "sdvx",
					song_id: songId,
					level: "9",
					level_num: 9,
					is_primary: true,
					difficulty: "EXHAUST",
					versions: ["epolis"],
					data: JSON.stringify({}),
				},
			])
			.execute();

		await DB.insertInto("folder")
			.values({
				id: folderId,
				legacy_id: folderLegacy,
				game: "iidx-sp",
				inactive: false,
				title: "OR game filter",
				slug: folderId,
				where: "chart.level_num = 9 OR chart.level_num = 10",
				version_filter: ["epolis"],
				search_terms: [],
			})
			.execute();

		const { folderQuery: built } = await BuildFolderQuery(folderId);
		const { rows } = await built.execute(DB);
		const got = new Set((rows as Array<{ id: string }>).map((r) => r.id));

		expect(got.size).toBe(2);
		expect(got.has(chartA)).toBe(true);
		expect(got.has(chartB)).toBe(true);
		expect(got.has(otherGameChart)).toBe(false);
	});

	it("with version_filter, requires overlapping chart.versions", async () => {
		const { folderId, folderLegacy, songId, chartA, chartB } = ids("bfq2");

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 9_800_002,
				game_group: "iidx",
				title: "BFQ Song 2",
				artist: "Y",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		// Both charts match the numeric predicate; only chartA lists version "epolis".
		await DB.insertInto("chart")
			.values([
				{
					id: chartA,
					legacy_id: chartA,
					game: "iidx-sp",
					song_id: songId,
					level: "10",
					level_num: 10,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: ["epolis"],
					data: JSON.stringify({}),
				},
				{
					id: chartB,
					legacy_id: chartB,
					game: "iidx-sp",
					song_id: songId,
					level: "10",
					level_num: 10,
					is_primary: false,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({}),
				},
			])
			.execute();

		await DB.insertInto("folder")
			.values({
				id: folderId,
				legacy_id: folderLegacy,
				game: "iidx-sp",
				inactive: false,
				title: "Level 10 (EPOLIS)",
				slug: folderId,
				where: "chart.level_num = 10",
				version_filter: ["epolis"],
				search_terms: [],
			})
			.execute();

		const { folderQuery: built } = await BuildFolderQuery(folderId);
		const { rows } = await built.execute(DB);

		expect(rows).toHaveLength(1);
		expect((rows[0] as { id: string }).id).toBe(chartA);
	});
});

describe("Postgres table + folder helpers", () => {
	function tableIds(prefix: string) {
		const u = randomUUID().replace(/-/gu, "").slice(0, 12);

		return {
			tablePk: `${prefix}-tbl-${u}`,
			tableLegacy: `${prefix}-l-${u}`,
			folderA: `${prefix}-fa-${u}`,
			folderB: `${prefix}-fb-${u}`,
		};
	}

	it("LoadTableDocumentByLegacyId and GetTableForIDGuaranteed load folder ids", async () => {
		const { tablePk, tableLegacy, folderA, folderB } = tableIds("tfolder");

		for (const [id, title] of [
			[folderA, "A"],
			[folderB, "B"],
		] as const) {
			await DB.insertInto("folder")
				.values({
					id,
					legacy_id: `${id}-leg`,
					game: "iidx-sp",
					inactive: false,
					title,
					slug: id,
					where: "chart.level_num > 0",
					version_filter: null,
					search_terms: [],
				})
				.execute();
		}

		await DB.insertInto("table")
			.values({
				id: tablePk,
				legacy_id: tableLegacy,
				game: "iidx-sp",
				inactive: false,
				title: "Test table",
				default_value: false,
				slug: null,
			})
			.execute();

		await DB.insertInto("table_folder")
			.values([
				{ table_id: tablePk, folder_id: folderA, ordering: 0 },
				{ table_id: tablePk, folder_id: folderB, ordering: 1 },
			])
			.execute();

		const loaded = await LoadTableDocumentByLegacyId(tableLegacy);

		expect(loaded).toBeDefined();
		expect(loaded!.tableID).toBe(tableLegacy);
		expect(loaded!.game).toBe("iidx-sp");
		expect(loaded!.folders).toEqual([folderA, folderB]);

		const guaranteed = await GetTableForIDGuaranteed(tableLegacy);

		expect(guaranteed.folders).toEqual([folderA, folderB]);

		await expect(GetTableForIDGuaranteed("missing-table-id")).rejects.toThrow(
			"Couldn't find table with ID 'missing-table-id'.",
		);
	});

	it("GetFoldersFromTable returns documents in table.folders order", async () => {
		const { tablePk, tableLegacy, folderA, folderB } = tableIds("gfft");

		for (const [id, title] of [
			[folderA, "First"],
			[folderB, "Second"],
		] as const) {
			await DB.insertInto("folder")
				.values({
					id,
					legacy_id: `${id}-leg`,
					game: "iidx-sp",
					inactive: false,
					title,
					slug: id,
					where: "chart.level_num > 0",
					version_filter: null,
					search_terms: [],
				})
				.execute();
		}

		await DB.insertInto("table")
			.values({
				id: tablePk,
				legacy_id: tableLegacy,
				game: "iidx-sp",
				inactive: false,
				title: "Ord",
				default_value: false,
				slug: null,
			})
			.execute();

		await DB.insertInto("table_folder")
			.values({ table_id: tablePk, folder_id: folderA, ordering: 0 })
			.execute();

		const table: TableDocument = {
			tableID: tableLegacy,
			game: "iidx-sp",
			title: "Ord",
			description: "",
			folders: [folderB, folderA],
			inactive: false,
			default: false,
		};

		const folders = await GetFoldersFromTable(table);

		expect(folders.map((f) => f.folderID)).toEqual([folderB, folderA]);
		expect(folders.map((f) => f.title)).toEqual(["Second", "First"]);
	});
});
