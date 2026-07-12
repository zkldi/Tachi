import DB from "#services/pg/db";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { GetNextBmsPmsSongLegacyId } from "./db";

describe("GetNextBmsPmsSongLegacyId", () => {
	it("returns max(legacy_id) + 1 for the game_group", async () => {
		const maxRow = await DB.selectFrom("song")
			.select(sql<number>`coalesce(max(song.legacy_id), 0)::int`.as("m"))
			.where("game_group", "=", "pms")
			.executeTakeFirst();

		const base = maxRow?.m ?? 0;
		const newLegacyId = base + 1;
		const songNewID = `test-song-pms-legacy-seq-${newLegacyId}`;

		await DB.insertInto("song")
			.values({
				id: songNewID,
				legacy_id: newLegacyId,
				game_group: "pms",
				title: "t",
				artist: "a",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		const n = await GetNextBmsPmsSongLegacyId("pms");

		expect(n).toBe(newLegacyId + 1);

		await DB.deleteFrom("song").where("id", "=", songNewID).execute();
	});
});
