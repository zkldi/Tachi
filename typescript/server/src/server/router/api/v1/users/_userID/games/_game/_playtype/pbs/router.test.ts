import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { type ScoreData } from "tachi-common";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

let seedCounter = 0;

async function seedIidxSpProfile(userId: number) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userId,
			game: "iidx-sp",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
			...newGameProfilePreferenceColumns("iidx-sp"),
		})
		.execute();
}

async function seedIidxChartPb(opts: { userId: number; withComposition?: boolean }) {
	const n = ++seedCounter;
	const songPg = `S_UGPT_PB_${n}`;
	const chartPg = `C_UGPT_PB_${n}`;
	const chartLegacy = `c_ugpt_pb_legacy_${n}`;
	const scoreId = `sc-ugpt-pb-${n}`;

	await DB.insertInto("song")
		.values({
			id: songPg,
			legacy_id: 88_000 + n,
			game_group: "iidx",
			title: "PB Router Test",
			artist: "Tester",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartPg,
			legacy_id: chartLegacy,
			game: "iidx-sp",
			song_id: songPg,
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: ["27"],
			data: { inGameID: 1000, notecount: 786 },
		})
		.execute();

	const now = new Date().toISOString();

	if (opts.withComposition) {
		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
			grade: "AAA",
			lamp: "EX HARD CLEAR",
			percent: 90,
			score: 1400,
			optional: {},
			judgements: {},
		} as ScoreData<"iidx-sp">);

		await DB.insertInto("score")
			.values({
				id: scoreId,
				user_id: opts.userId,
				chart_id: chartPg,
				game: "iidx-sp",
				session_id: null,
				import_id: null,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: JSON.stringify(judgements),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: now,
				time_added: now,
				highlight: false,
				comment: null,
			})
			.execute();
	}

	const pbIns = await DB.insertInto("pb")
		.values({
			user_id: opts.userId,
			chart_id: chartPg,
			lens: null,
			data: JSON.stringify({}),
			derived_data: JSON.stringify({}),
			calculated_data: JSON.stringify({}),
			judgements: JSON.stringify({}),
			ranking_value: 100,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: false,
			time_achieved: now,
		})
		.returning("row_id")
		.executeTakeFirstOrThrow();

	if (opts.withComposition) {
		await DB.insertInto("pb_composed_from")
			.values({ pb_id: pbIns.row_id, score_id: scoreId, merge_name: "Default" })
			.execute();
	}

	return { chartPg, chartLegacy, scoreId, songPg };
}

async function insertPbOnChart(opts: {
	calculatedData: Record<string, unknown>;
	chartPg: string;
	rankingValue?: number;
	userId: number;
}) {
	const now = new Date().toISOString();
	await DB.insertInto("pb")
		.values({
			user_id: opts.userId,
			chart_id: opts.chartPg,
			lens: null,
			data: JSON.stringify({}),
			derived_data: JSON.stringify({}),
			calculated_data: JSON.stringify(opts.calculatedData),
			judgements: JSON.stringify({}),
			ranking_value: opts.rankingValue ?? 0,
			ranking_value_tb1: null,
			ranking_value_tb2: null,
			ranking_value_tb3: null,
			ranking_value_tb4: null,
			ranking_value_tb5: null,
			highlight: false,
			time_achieved: now,
		})
		.execute();
}

describe("GET /api/v1/users/:userID/games/:game/pbs/all", () => {
	it("returns primary-chart PBs with songs and charts", async () => {
		const { id: userId } = await seedUser({ username: "ugpt_pb_all" });
		await seedIidxSpProfile(userId);
		await seedIidxChartPb({ userId });
		await seedIidxChartPb({ userId });

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/pbs/all`);

		expect(res.status).toBe(200);
		expect(res.body.body.pbs.length).toBeGreaterThanOrEqual(2);
		expect(res.body.body.songs.length).toBeGreaterThanOrEqual(1);
		expect(res.body.body.charts.length).toBeGreaterThanOrEqual(2);
	});
});

describe("GET /api/v1/users/:userID/games/:game/pbs/best", () => {
	it("orders primary PBs by ktLampRating descending by default", async () => {
		const { id: userId } = await seedUser({ username: "ugpt_pb_best" });
		await seedIidxSpProfile(userId);

		const a = await seedIidxChartPb({ userId });
		const b = await seedIidxChartPb({ userId });

		await DB.deleteFrom("pb").where("chart_id", "=", a.chartPg).execute();
		await DB.deleteFrom("pb").where("chart_id", "=", b.chartPg).execute();

		await insertPbOnChart({
			userId,
			chartPg: a.chartPg,
			calculatedData: { ktLampRating: 10 },
		});
		await insertPbOnChart({
			userId,
			chartPg: b.chartPg,
			calculatedData: { ktLampRating: 99 },
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/pbs/best`);

		expect(res.status).toBe(200);
		expect(res.body.body.pbs[0].calculatedData.ktLampRating).toBe(99);
		expect(res.body.body.pbs[1].calculatedData.ktLampRating).toBe(10);
	});

	it("orders by alg=BPI with non-null values before null (NULLS LAST)", async () => {
		const { id: userId } = await seedUser({ username: "ugpt_pb_best_bpi" });
		await seedIidxSpProfile(userId);

		const nullA = await seedIidxChartPb({ userId });
		const nullB = await seedIidxChartPb({ userId });
		const nullC = await seedIidxChartPb({ userId });
		const mid = await seedIidxChartPb({ userId });
		const top = await seedIidxChartPb({ userId });

		for (const { chartPg } of [nullA, nullB, nullC, mid, top]) {
			await DB.deleteFrom("pb").where("chart_id", "=", chartPg).execute();
		}

		for (const { chartPg } of [nullA, nullB, nullC]) {
			await insertPbOnChart({
				userId,
				chartPg,
				calculatedData: { BPI: null, ktLampRating: 1 },
			});
		}
		await insertPbOnChart({
			userId,
			chartPg: mid.chartPg,
			calculatedData: { BPI: 50, ktLampRating: 1 },
		});
		await insertPbOnChart({
			userId,
			chartPg: top.chartPg,
			calculatedData: { BPI: 99, ktLampRating: 1 },
		});

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/pbs/best?alg=BPI`);

		expect(res.status).toBe(200);
		const bpis = res.body.body.pbs.map(
			(p: { calculatedData: { BPI: number | null } }) => p.calculatedData.BPI,
		);
		expect(bpis.slice(0, 2)).toEqual([99, 50]);
		expect(bpis.slice(2).every((b: number | null) => b === null)).toBe(true);
	});
});

describe("GET /api/v1/users/:userID/games/:game/pbs/:chartID/rivals", () => {
	it("returns rival PBs and the user PB on the chart", async () => {
		const { id: mainId } = await seedUser({ username: "ugpt_pb_main" });
		const { id: rivalId } = await seedUser({ username: "ugpt_pb_rival" });
		await seedIidxSpProfile(mainId);
		await seedIidxSpProfile(rivalId);

		await DB.insertInto("game_rival")
			.values({ user_id: mainId, game: "iidx-sp", rival: rivalId })
			.execute();

		const { chartPg } = await seedIidxChartPb({ userId: mainId });
		await insertPbOnChart({
			userId: rivalId,
			chartPg,
			calculatedData: { ktLampRating: 50 },
		});

		const res = await mockApi.get(
			`/api/v1/users/${mainId}/games/iidx-sp/pbs/${chartPg}/rivals`,
		);

		expect(res.status).toBe(200);
		const userIds = res.body.body.pbs.map((p: { userID: number }) => p.userID).sort();
		expect(userIds).toEqual([mainId, rivalId].sort((a, b) => a - b));
	});
});

describe("GET /api/v1/users/:userID/games/:game/pbs/:chartID/leaderboard-adjacent", () => {
	it("returns adjacent ladder ranks around the user", async () => {
		const { id: u1 } = await seedUser({ username: "ugpt_pb_lb1" });
		const { id: u2 } = await seedUser({ username: "ugpt_pb_lb2" });
		const { id: u3 } = await seedUser({ username: "ugpt_pb_lb3" });
		await seedIidxSpProfile(u1);
		await seedIidxSpProfile(u2);
		await seedIidxSpProfile(u3);

		const n = ++seedCounter;
		const songPg = `S_LB_${n}`;
		const chartPg = `C_LB_${n}`;
		const chartLegacy = `c_lb_${n}`;

		await DB.insertInto("song")
			.values({
				id: songPg,
				legacy_id: 90_000 + n,
				game_group: "iidx",
				title: "Ladder",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartPg,
				legacy_id: chartLegacy,
				game: "iidx-sp",
				song_id: songPg,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		await insertPbOnChart({ userId: u1, chartPg, calculatedData: {}, rankingValue: 300 });
		await insertPbOnChart({ userId: u2, chartPg, calculatedData: {}, rankingValue: 200 });
		await insertPbOnChart({ userId: u3, chartPg, calculatedData: {}, rankingValue: 100 });

		const res = await mockApi.get(
			`/api/v1/users/${u2}/games/iidx-sp/pbs/${chartPg}/leaderboard-adjacent`,
		);

		expect(res.status).toBe(200);
		const aboveRanks = res.body.body.adjacentAbove.map(
			(p: { rankingData: { rank: number } }) => p.rankingData.rank,
		);
		const belowRanks = res.body.body.adjacentBelow.map(
			(p: { rankingData: { rank: number } }) => p.rankingData.rank,
		);
		expect(aboveRanks).toContain(1);
		expect(belowRanks).toContain(3);
	});
});

describe("GET /api/v1/users/:userID/games/:game/pbs/song/:songID", () => {
	it("returns 404 when the song does not exist", async () => {
		const { id } = await seedUser({ username: "ugpt_pb_song_missing" });
		await seedIidxSpProfile(id);

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/iidx-sp/pbs/song/nonexistent-song-id-000`,
		);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns PBs for every chart on the song the user has played", async () => {
		const { id: userId } = await seedUser({ username: "ugpt_pb_song_multi" });
		await seedIidxSpProfile(userId);

		const n = ++seedCounter;
		const songPg = `S_UGPT_PB_MULT_${n}`;
		const chartPgA = `C_UGPT_PB_MULT_A_${n}`;
		const chartPgB = `C_UGPT_PB_MULT_B_${n}`;

		await DB.insertInto("song")
			.values({
				id: songPg,
				legacy_id: 91_000 + n,
				game_group: "iidx",
				title: "Multi difficulty PB",
				artist: "Tester",
				search_terms: [],
				alt_titles: [],
				data: { displayVersion: "1", genre: "TEST" },
				fts_document: "",
			})
			.execute();

		for (const [chartPg, difficulty] of [
			[chartPgA, "ANOTHER"],
			[chartPgB, "HYPER"],
		] as const) {
			await DB.insertInto("chart")
				.values({
					id: chartPg,
					legacy_id: `${chartPg}_leg`,
					game: "iidx-sp",
					song_id: songPg,
					difficulty,
					level: "10",
					level_num: 10,
					is_primary: true,
					versions: ["27"],
					data: { inGameID: 1000, notecount: 786 },
				})
				.execute();

			await insertPbOnChart({
				userId,
				chartPg,
				calculatedData: { ktLampRating: difficulty === "ANOTHER" ? 80 : 40 },
			});
		}

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/pbs/song/${songPg}`);

		expect(res.status).toBe(200);
		expect(res.body.body.pbs).toHaveLength(2);
		const chartIds = res.body.body.pbs.map((p: { chartID: string }) => p.chartID).sort();
		expect(chartIds).toEqual([chartPgA, chartPgB].sort());
		expect(res.body.body.charts).toHaveLength(2);
		expect(res.body.body.songs).toHaveLength(1);
		expect(res.body.body.songs[0].id).toBe(songPg);
	});

	it("returns empty PBs when the user has not played any chart of the song", async () => {
		const { id: userId } = await seedUser({ username: "ugpt_pb_song_empty" });
		await seedIidxSpProfile(userId);

		const { songPg } = await seedIidxChartPb({ userId });

		const { id: otherId } = await seedUser({ username: "ugpt_pb_song_empty_b" });
		await seedIidxSpProfile(otherId);

		const res = await mockApi.get(`/api/v1/users/${otherId}/games/iidx-sp/pbs/song/${songPg}`);

		expect(res.status).toBe(200);
		expect(res.body.body.pbs).toHaveLength(0);
		expect(res.body.body.charts).toHaveLength(0);
		expect(res.body.body.songs).toHaveLength(0);
	});
});

describe("GET /api/v1/users/:userID/games/:game/pbs/:chartID", () => {
	it("returns 404 when the chart does not exist", async () => {
		const { id } = await seedUser({ username: "ugpt_pb_chart_missing" });
		await seedIidxSpProfile(id);

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/iidx-sp/pbs/00000000-0000-0000-0000-000000000000`,
		);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
		expect(res.body.description).toContain("chart");
	});

	it("returns 404 when the user has no PB on the chart", async () => {
		const { id: targetId } = await seedUser({ username: "ugpt_pb_none" });
		await seedIidxSpProfile(targetId);

		const n = ++seedCounter;
		const songPg = `S_UGPT_PB_EMPTY_${n}`;
		const chartPg = `C_UGPT_PB_EMPTY_${n}`;

		await DB.insertInto("song")
			.values({
				id: songPg,
				legacy_id: 89_000 + n,
				game_group: "iidx",
				title: "No PB",
				artist: "A",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({}),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartPg,
				legacy_id: `${chartPg}_leg`,
				game: "iidx-sp",
				song_id: songPg,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "NORMAL",
				versions: [],
				data: JSON.stringify({}),
			})
			.execute();

		const res = await mockApi.get(`/api/v1/users/${targetId}/games/iidx-sp/pbs/${chartPg}`);

		expect(res.status).toBe(404);
		expect(res.body.description).toContain("not played");
	});

	it("returns pb and chart (by Postgres chart id)", async () => {
		const { id: targetId } = await seedUser({ username: "ugpt_pb_ok" });
		await seedIidxSpProfile(targetId);
		const { chartPg } = await seedIidxChartPb({ userId: targetId });

		const res = await mockApi.get(`/api/v1/users/${targetId}/games/iidx-sp/pbs/${chartPg}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.chart.chartID).toBe(chartPg);
		expect(res.body.body.pb.userID).toBe(targetId);
	});

	it("returns composed scores when getComposition is set", async () => {
		const { id: targetId } = await seedUser({ username: "ugpt_pb_comp" });
		await seedIidxSpProfile(targetId);
		const { chartPg, scoreId } = await seedIidxChartPb({
			userId: targetId,
			withComposition: true,
		});

		const res = await mockApi.get(
			`/api/v1/users/${targetId}/games/iidx-sp/pbs/${chartPg}?getComposition=1`,
		);

		expect(res.status).toBe(200);
		expect(res.body.body.scores).toHaveLength(1);
		expect(res.body.body.scores[0].scoreID).toBe(scoreId);
	});
});
