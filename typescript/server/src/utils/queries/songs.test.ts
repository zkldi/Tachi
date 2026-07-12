import DB from "#services/pg/db";
import { describe, expect, it } from "vitest";

import { FindSongOnID, FindSongOnTitle, FindSongOnTitleInsensitive } from "./songs";

describe("FindSongOnTitle / FindSongOnTitleInsensitive / FindSongOnID (Postgres)", () => {
	it("FindSongOnTitle matches title or alt_titles", async () => {
		const suffix = `${Date.now()}`;
		const title = `Unique Title ${suffix}`;
		const songId = `song-ft-${suffix}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 4_200_000,
				game_group: "iidx",
				title,
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		const byTitle = await FindSongOnTitle("iidx", title);
		expect(byTitle?.id).toBe(songId);

		const songId2 = `song-ft2-${suffix}`;
		await DB.insertInto("song")
			.values({
				id: songId2,
				legacy_id: 4_200_001,
				game_group: "iidx",
				title: "Other",
				artist: "B",
				search_terms: [],
				alt_titles: [`Alt ${suffix}`],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		const byAlt = await FindSongOnTitle("iidx", `Alt ${suffix}`);
		expect(byAlt?.id).toBe(songId2);
	});

	it("FindSongOnTitleInsensitive matches case-insensitively", async () => {
		const suffix = `${Date.now()}`;
		const songId = `song-fi-${suffix}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 4_200_010,
				game_group: "popn",
				title: `CaSeD ${suffix}`,
				artist: "ArtistX",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		const doc = await FindSongOnTitleInsensitive("popn", `cased ${suffix}`, "artistx");
		expect(doc?.id).toBe(songId);
	});

	it("FindSongOnID returns song by id", async () => {
		const suffix = `${Date.now()}`;
		const songId = `song-fid-${suffix}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 4_200_020,
				game_group: "sdvx",
				title: "T",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		const doc = await FindSongOnID("sdvx", songId);
		expect(doc?.title).toBe("T");
	});
});
