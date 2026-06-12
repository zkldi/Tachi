import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
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
		})
		.execute();
}

async function seedIidxChartAndScores(opts: { otherUserId: number; targetUserId: number }) {
	const n = ++seedCounter;
	const songPg = `S_UG_SC_${n}`;
	const chartPg = `C_UG_SC_${n}`;
	const chartLegacy = `c_ug_sc_legacy_${n}`;

	await DB.insertInto("song")
		.values({
			id: songPg,
			legacy_id: 77_000 + n,
			game_group: "iidx",
			title: "Chart Scores Test",
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

	for (const [idx, userId] of [
		[1, opts.targetUserId],
		[2, opts.targetUserId],
		[3, opts.otherUserId],
	] as const) {
		await DB.insertInto("score")
			.values({
				id: `sc-ug-${n}-${idx}`,
				user_id: userId,
				chart_id: chartPg,
				game: "iidx-sp",
				session_id: null,
				import_id: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				judgements: JSON.stringify({}),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: now,
				time_added: now,
				highlight: false,
				comment: null,
			})
			.execute();
	}

	return {
		chartPg,
		chartLegacy,
		targetScoreIds: [`sc-ug-${n}-1`, `sc-ug-${n}-2`] as const,
	};
}

describe("GET /api/v1/users/:userID/games/:game/scores/:chartID", () => {
	it("returns 404 when the chart does not exist", async () => {
		const { id } = await seedUser({ username: "ug_scores_chart_missing" });
		await seedIidxSpProfile(id);

		const res = await mockApi.get(
			`/api/v1/users/${id}/games/iidx-sp/scores/00000000-0000-0000-0000-000000000000`,
		);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
		expect(res.body.description).toContain("chart");
	});

	it("returns 200 with an empty array when the user has no scores on the chart", async () => {
		const { id: targetId } = await seedUser({ username: "ug_scores_chart_empty" });
		const { id: otherId } = await seedUser({ username: "ug_scores_chart_empty_other" });
		await seedIidxSpProfile(targetId);
		await seedIidxSpProfile(otherId);

		const songPg = `S_UG_EMPTY_${++seedCounter}`;
		const chartPg = `C_UG_EMPTY_${seedCounter}`;

		await DB.insertInto("song")
			.values({
				id: songPg,
				legacy_id: 78_000 + seedCounter,
				game_group: "iidx",
				title: "Empty",
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

		const res = await mockApi.get(`/api/v1/users/${targetId}/games/iidx-sp/scores/${chartPg}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual([]);

		// Other user may have scores on the same chart - still empty for target.
		await DB.insertInto("score")
			.values({
				id: `sc-ug-empty-other-${seedCounter}`,
				user_id: otherId,
				chart_id: chartPg,
				game: "iidx-sp",
				session_id: null,
				import_id: null,
				data: JSON.stringify({}),
				derived_data: JSON.stringify({}),
				judgements: JSON.stringify({}),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: null,
				time_added: new Date().toISOString(),
				highlight: false,
				comment: null,
			})
			.execute();

		const res2 = await mockApi.get(`/api/v1/users/${targetId}/games/iidx-sp/scores/${chartPg}`);
		expect(res2.body.body).toEqual([]);
	});

	it("returns scores for the user on the chart (by Postgres chart id)", async () => {
		const { id: targetId } = await seedUser({ username: "ug_scores_chart_a" });
		const { id: otherId } = await seedUser({ username: "ug_scores_chart_b" });
		await seedIidxSpProfile(targetId);
		await seedIidxSpProfile(otherId);
		const { chartPg, targetScoreIds } = await seedIidxChartAndScores({
			targetUserId: targetId,
			otherUserId: otherId,
		});

		const res = await mockApi.get(`/api/v1/users/${targetId}/games/iidx-sp/scores/${chartPg}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toHaveLength(2);
		const ids = res.body.body.map((s: { scoreID: string }) => s.scoreID).sort();
		expect(ids).toEqual([...targetScoreIds].sort());
	});
});
