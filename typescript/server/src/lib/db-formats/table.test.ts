import DB from "#services/pg/db";
import { sql } from "kysely";
import { readFileSync } from "node:fs";
import { CreateTableID, type V3Game } from "tachi-common";
import { describe, expect, it } from "vitest";

import {
	GetTableDocumentsForGame,
	LoadTableDocumentByGameAndSlug,
	LoadTableDocumentById,
} from "./table";

async function insertTable(slug: string, game: V3Game = "iidx-sp", inactive = false) {
	const id = CreateTableID();
	await DB.insertInto("table")
		.values({
			id,
			slug,
			game,
			inactive,
			title: "Lookup test",
			default_value: false,
		})
		.execute();
	return id;
}

describe("table lookups", () => {
	it("loads by slug and current ID, returning both", async () => {
		const id = await insertTable("levels");
		for (const key of ["levels", id]) {
			expect(await LoadTableDocumentByGameAndSlug("iidx-sp", key)).toMatchObject({
				tableID: id,
				slug: "levels",
				game: "iidx-sp",
				folders: [],
			});
		}
		expect(await LoadTableDocumentById(id)).toMatchObject({ tableID: id, slug: "levels" });
		expect(await LoadTableDocumentById("levels")).toBeUndefined();
	});

	it("scopes both slug and ID lookups to the game", async () => {
		const sp = await insertTable("levels", "iidx-sp");
		const dp = await insertTable("levels", "iidx-dp");
		expect((await LoadTableDocumentByGameAndSlug("iidx-sp", "levels"))?.tableID).toBe(sp);
		expect((await LoadTableDocumentByGameAndSlug("iidx-dp", "levels"))?.tableID).toBe(dp);
		expect(await LoadTableDocumentByGameAndSlug("iidx-dp", sp)).toBeUndefined();
		expect(await LoadTableDocumentByGameAndSlug("sdvx", "levels")).toBeUndefined();
		expect(await LoadTableDocumentByGameAndSlug("iidx-sp", "missing")).toBeUndefined();
	});

	it("prefers slug over ID when keys collide", async () => {
		const key = "table-key";
		await DB.insertInto("table")
			.values({
				id: key,
				slug: "other",
				game: "iidx-sp",
				inactive: false,
				title: "ID match",
				default_value: false,
			})
			.execute();
		const slugMatch = await insertTable(key);
		expect((await LoadTableDocumentByGameAndSlug("iidx-sp", key))?.tableID).toBe(slugMatch);
	});

	it("lists active tables with slugs and current IDs", async () => {
		const active = await insertTable("active");
		const inactive = await insertTable("inactive", "iidx-sp", true);
		await insertTable("elsewhere", "iidx-dp");
		expect(await GetTableDocumentsForGame("iidx-sp", false)).toEqual([
			expect.objectContaining({ tableID: active, slug: "active" }),
		]);
		expect(
			(await GetTableDocumentsForGame("iidx-sp", true)).map((t) => t.tableID).sort(),
		).toEqual([active, inactive].sort());
	});

	it("enforces unique slugs per game and URL-safe syntax", async () => {
		await insertTable("levels");
		await expect(insertTable("levels")).rejects.toThrow(/table_game_slug_key/u);
		await expect(insertTable("Bad_slug")).rejects.toThrow(/table_slug_format/u);
		await expect(insertTable("")).rejects.toThrow(/table_slug_format/u);
	});
});

describe("table slug migration", () => {
	it("backfills slugs and preserves default-table preferences before dropping legacy IDs", async () => {
		const migration = readFileSync(
			new URL("../../../../../db/migrations/20261115140000_table_slugs.sql", import.meta.url),
			"utf8",
		);

		await DB.transaction().execute(async (txn) => {
			// Shadow the real tables so the migration can run against the previous schema.
			await sql
				.raw(`
				CREATE TEMP TABLE "table" (
					id text PRIMARY KEY, legacy_id text UNIQUE NOT NULL,
					game text NOT NULL, slug text
				) ON COMMIT DROP;
				CREATE UNIQUE INDEX table_unique_slug_game ON "table" (game, slug) WHERE slug IS NOT NULL;
				CREATE TEMP TABLE game_profile (game text, pf_default_table text) ON COMMIT DROP;
				INSERT INTO "table" (id, legacy_id, game, slug) VALUES
					('table-sp', 'iidx-SP-31-levels', 'iidx-sp', NULL),
					('table-dp', 'iidx-DP-31-levels', 'iidx-dp', NULL),
					('table-ec', 'bms-7K-sgl-EC', 'bms-7k', ''),
					('table-museca', 'museca-Single-1.5-b-levels', 'museca', NULL),
					('table-custom', 'custom-Single-old-name', 'museca', 'chosen-slug');
				INSERT INTO game_profile VALUES
					('iidx-sp', 'iidx-SP-31-levels'),
					('iidx-dp', 'iidx-DP-31-levels'),
					('bms-7k', 'table-ec'),
					('iidx-dp', 'iidx-SP-31-levels'),
					('museca', NULL);
			`)
				.execute(txn);

			await sql.raw(migration).execute(txn);
			const tables = await sql<{
				id: string;
				slug: string;
			}>`SELECT id, slug FROM "table"`.execute(txn);
			expect(tables.rows).toEqual(
				expect.arrayContaining([
					{ id: "table-sp", slug: "31-levels" },
					{ id: "table-dp", slug: "31-levels" },
					{ id: "table-ec", slug: "sgl-ec" },
					{ id: "table-museca", slug: "1-5-b-levels" },
					{ id: "table-custom", slug: "chosen-slug" },
				]),
			);
			const profiles = await sql<{ game: string; pf_default_table: string | null }>`
				SELECT game, pf_default_table FROM game_profile
			`.execute(txn);
			expect(profiles.rows).toHaveLength(5);
			expect(profiles.rows).toEqual(
				expect.arrayContaining([
					{ game: "bms-7k", pf_default_table: "table-ec" },
					{ game: "iidx-dp", pf_default_table: "iidx-SP-31-levels" },
					{ game: "museca", pf_default_table: null },
					{ game: "iidx-sp", pf_default_table: "table-sp" },
					{ game: "iidx-dp", pf_default_table: "table-dp" },
				]),
			);
			const columns = await sql<{ attname: string }>`
				SELECT attname FROM pg_attribute
				WHERE attrelid = 'pg_temp.table'::regclass AND attnum > 0 AND NOT attisdropped
			`.execute(txn);
			expect(columns.rows.map((c) => c.attname)).toEqual(["id", "game", "slug"]);
		});
	});
});
