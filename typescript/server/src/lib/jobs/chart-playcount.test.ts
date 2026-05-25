import { ReconcileChartPlaycountJob } from "#lib/jobs/reconcile-chart-playcount";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { FindChartsOnPopularity } from "#utils/queries/charts";
import { describe, expect, it } from "vitest";

function makeSongId(n: number): string {
	return `S${n.toString(16).padStart(20, "0")}`;
}

function makeChartId(n: number): string {
	return `C${n.toString(16).padStart(20, "0")}`;
}

function makeLegacyId(n: number): string {
	return n.toString(16).padStart(40, "0");
}

function makeScoreId(n: number): string {
	return `SC${n.toString(16).padStart(20, "0")}`;
}

async function getCachedPlaycount(chartId: string): Promise<number> {
	const row = await DB.selectFrom("chart_playcount")
		.select("chart_playcount.playcount")
		.where("chart_playcount.chart_id", "=", chartId)
		.executeTakeFirst();

	return row?.playcount ?? 0;
}

function scoreRow(id: string, userId: number, chartId: string, game: "iidx-sp" = "iidx-sp") {
	return {
		id,
		user_id: userId,
		chart_id: chartId,
		game,
		session_id: null,
		import_id: null,
		data: JSON.stringify({}),
		derived_data: JSON.stringify({}),
		judgements: JSON.stringify({}),
		calculated_data: JSON.stringify({}),
		meta: JSON.stringify({}),
		time_achieved: new Date().toISOString(),
		time_added: new Date().toISOString(),
		highlight: false,
		comment: null,
	};
}

describe("chart_playcount triggers", () => {
	it("increments on score insert and decrements on delete", async () => {
		const songID = makeSongId(10_001);
		const chartID = makeChartId(10_001);

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: 9_010_001,
				game_group: "iidx",
				title: "Playcount Trigger Song",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartID,
				legacy_id: makeLegacyId(10_001),
				game: "iidx-sp",
				song_id: songID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: [],
				data: JSON.stringify({ notecount: 100 }),
			})
			.execute();

		expect(await getCachedPlaycount(chartID)).toBe(0);

		const { id: userID } = await seedUser({ username: "playcount_trigger_user" });
		const scoreID = makeScoreId(10_001);

		await DB.insertInto("score")
			.values(scoreRow(scoreID, userID, chartID))
			.execute();

		expect(await getCachedPlaycount(chartID)).toBe(1);

		await DB.deleteFrom("score").where("score.id", "=", scoreID).execute();

		expect(await getCachedPlaycount(chartID)).toBe(0);
	});

	it("batch-inserts increment once per chart", async () => {
		const songID = makeSongId(10_002);
		const chartID = makeChartId(10_002);

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: 9_010_002,
				game_group: "iidx",
				title: "Playcount Batch Song",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartID,
				legacy_id: makeLegacyId(10_002),
				game: "iidx-sp",
				song_id: songID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: [],
				data: JSON.stringify({ notecount: 100 }),
			})
			.execute();

		const { id: userID } = await seedUser({ username: "playcount_batch_user" });

		await DB.insertInto("score")
			.values([
				scoreRow(makeScoreId(10_002), userID, chartID),
				scoreRow(makeScoreId(10_003), userID, chartID),
				scoreRow(makeScoreId(10_004), userID, chartID),
			])
			.execute();

		expect(await getCachedPlaycount(chartID)).toBe(3);
	});

	it("moves count when score chart_id changes on update", async () => {
		const songID = makeSongId(10_003);
		const chartA = makeChartId(10_003);
		const chartB = makeChartId(10_004);

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: 9_010_003,
				game_group: "iidx",
				title: "Playcount Move Song",
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
					legacy_id: makeLegacyId(10_003),
					game: "iidx-sp",
					song_id: songID,
					level: "10",
					level_num: 10,
					is_primary: true,
					difficulty: "ANOTHER",
					versions: [],
					data: JSON.stringify({ notecount: 100 }),
				},
				{
					id: chartB,
					legacy_id: makeLegacyId(10_004),
					game: "iidx-sp",
					song_id: songID,
					level: "11",
					level_num: 11,
					is_primary: false,
					difficulty: "HYPER",
					versions: [],
					data: JSON.stringify({ notecount: 80 }),
				},
			])
			.execute();

		const { id: userID } = await seedUser({ username: "playcount_move_user" });
		const scoreID = makeScoreId(10_005);

		await DB.insertInto("score")
			.values(scoreRow(scoreID, userID, chartA))
			.execute();

		expect(await getCachedPlaycount(chartA)).toBe(1);
		expect(await getCachedPlaycount(chartB)).toBe(0);

		await DB.updateTable("score")
			.set({ chart_id: chartB })
			.where("score.id", "=", scoreID)
			.execute();

		expect(await getCachedPlaycount(chartA)).toBe(0);
		expect(await getCachedPlaycount(chartB)).toBe(1);
	});

	it("FindChartsOnPopularity reads cached playcounts", async () => {
		const songID = makeSongId(10_005);
		const chartID = makeChartId(10_005);

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: 9_010_005,
				game_group: "iidx",
				title: "Popularity Cache Song",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartID,
				legacy_id: makeLegacyId(10_005),
				game: "iidx-sp",
				song_id: songID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: [],
				data: JSON.stringify({ notecount: 100 }),
			})
			.execute();

		const { id: userID } = await seedUser({ username: "popularity_cache_user" });

		await DB.insertInto("score")
			.values(scoreRow(makeScoreId(10_006), userID, chartID))
			.execute();

		const charts = await FindChartsOnPopularity(
			"iidx-sp",
			{ songIDs: [songID], chartIDs: undefined },
			0,
			100,
		);

		expect(charts).toHaveLength(1);
		expect(charts[0]?.chartID).toBe(chartID);
		expect(charts[0]?.__playcount).toBe(1);
	});

	it("ReconcileChartPlaycountJob fixes drift", async () => {
		const songID = makeSongId(10_006);
		const chartID = makeChartId(10_006);

		await DB.insertInto("song")
			.values({
				id: songID,
				legacy_id: 9_010_006,
				game_group: "iidx",
				title: "Reconcile Song",
				artist: "X",
				search_terms: [],
				alt_titles: [],
				fts_document: "",
				data: JSON.stringify({}),
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartID,
				legacy_id: makeLegacyId(10_006),
				game: "iidx-sp",
				song_id: songID,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: [],
				data: JSON.stringify({ notecount: 100 }),
			})
			.execute();

		const { id: userID } = await seedUser({ username: "reconcile_user" });

		await DB.insertInto("score")
			.values(scoreRow(makeScoreId(10_007), userID, chartID))
			.execute();

		await DB.updateTable("chart_playcount")
			.set({ playcount: 99 })
			.where("chart_playcount.chart_id", "=", chartID)
			.execute();

		await ReconcileChartPlaycountJob();

		expect(await getCachedPlaycount(chartID)).toBe(1);
	});
});
