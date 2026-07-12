import { GetChartById } from "#lib/db-formats/chart";
import DB from "#services/pg/db";
import { CloseServerConnection } from "#test-utils/mock-api";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

const SONG_PG_ID = "S_TEST_CHARTFMT_SONG_001";
const CHART_ID = "C_TEST_CHARTFMT_CHART_001";
const SONG_LEGACY_ID = 50_001;
const CHART_LEGACY_ID = "c2311194e3897ddb5745b1760d2c0141f933e683";

async function seedSong() {
	await DB.insertInto("song")
		.values({
			id: SONG_PG_ID,
			legacy_id: SONG_LEGACY_ID,
			game_group: "iidx",
			title: "Test",
			artist: "Artist",
			search_terms: [],
			alt_titles: [],
			data: {},
			fts_document: "",
		})
		.execute();
}

async function seedChart() {
	await DB.insertInto("chart")
		.values({
			id: CHART_ID,
			legacy_id: CHART_LEGACY_ID,
			game: "iidx-sp",
			song_id: SONG_PG_ID,
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: ["27"],
			data: { inGameID: 1, notecount: 100 },
		})
		.execute();
}

async function cleanup() {
	await DB.deleteFrom("chart").where("chart.id", "=", CHART_ID).execute();
	await DB.deleteFrom("song").where("song.id", "=", SONG_PG_ID).execute();
}

describe("GetChartById", () => {
	beforeEach(async () => {
		await cleanup();
		await seedSong();
		await seedChart();
	});

	it("resolves by Postgres chart id", async () => {
		const c = await GetChartById(CHART_ID);

		expect(c).toBeDefined();
		expect(c!.game).toBe("iidx-sp");
		expect(c!.chartID).toBe(CHART_ID);
		expect(c!.legacyChartID).toBe(CHART_LEGACY_ID);
		expect(c!.song.id).toBe(SONG_PG_ID);
		expect(c!.versions).toContain("27");
	});

	it("returns undefined when no chart matches", async () => {
		const c = await GetChartById("nonexistent-chart-id");

		expect(c).toBeUndefined();
	});
});
