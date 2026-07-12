import DB from "#services/pg/db";
import { describe, expect, it } from "vitest";

import { FindChartOnInGameIDIfUnique, FindChartWithChartID } from "./charts";

describe("FindChartWithChartID (Postgres)", () => {
	it("finds chart by Postgres id", async () => {
		const suffix = `${Date.now()}`;
		const chartId = `chart-fc-${suffix}`;
		const songId = `song-fc-${suffix}`;

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 5_100_000,
				game_group: "ddr",
				title: "T",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: `legacy-${suffix}`,
				game: "ddr-sp",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "EXPERT",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		const doc = await FindChartWithChartID(chartId);
		expect(doc).not.toBeNull();
		expect(doc?.chartID).toBe(chartId);
		expect(doc?.song.id).toBe(songId);
	});

	it("returns null when missing", async () => {
		expect(await FindChartWithChartID("no-such-chart")).toBeNull();
	});
});

describe("FindChartOnInGameIDIfUnique (Postgres)", () => {
	it("returns the chart when exactly one row matches the in-game ID", async () => {
		const suffix = `${Date.now()}-ifu`;
		const songId = `song-ifu-${suffix}`;
		const chartId = `chart-ifu-${suffix}`;
		const inGameID = 7_770_000 + Math.floor(Math.random() * 500);

		await DB.insertInto("song")
			.values({
				id: songId,
				legacy_id: 5_200_000,
				game_group: "wacca",
				title: "T",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({ genre: "g", displayVersion: null }),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: `legacy-ifu-${suffix}`,
				game: "wacca",
				song_id: songId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "EXPERT",
				versions: [],
				data: JSON.stringify({ inGameID }),
			})
			.execute();

		const doc = await FindChartOnInGameIDIfUnique("wacca", inGameID);
		expect(doc).not.toBeNull();
		expect(doc!.chartID).toBe(chartId);
	});

	it("returns null when two charts share the in-game ID", async () => {
		const suffix = `${Date.now()}-if2`;
		const inGameID = 7_771_000 + Math.floor(Math.random() * 500);

		for (const part of ["a", "b"] as const) {
			const songId = `song-if2-${suffix}-${part}`;
			const chartId = `chart-if2-${suffix}-${part}`;

			await DB.insertInto("song")
				.values({
					id: songId,
					legacy_id: 5_200_001 + part.charCodeAt(0),
					game_group: "wacca",
					title: `T${part}`,
					artist: "A",
					search_terms: [],
					alt_titles: [],
					data: JSON.stringify({ genre: "g", displayVersion: null }),
					fts_document: "",
				})
				.execute();

			await DB.insertInto("chart")
				.values({
					id: chartId,
					legacy_id: `legacy-if2-${suffix}-${part}`,
					game: "wacca",
					song_id: songId,
					level: "10",
					level_num: 10,
					is_primary: true,
					difficulty: part === "a" ? "EXPERT" : "HARD",
					versions: [],
					data: JSON.stringify({ inGameID }),
				})
				.execute();
		}

		expect(await FindChartOnInGameIDIfUnique("wacca", inGameID)).toBeNull();
	});

	it("returns null when no chart matches", async () => {
		expect(await FindChartOnInGameIDIfUnique("wacca", 9_999_993)).toBeNull();
	});
});
