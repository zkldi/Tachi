import { seedApiToken } from "#actions/test-utils/api-tokens";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { type ScoreData } from "tachi-common";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

const SONG_PG = "S_SESS_ROUTER_TEST";
const CHART_PG = "C_SESS_ROUTER_TEST";
const CHART_LEGACY = "c_sess_router_test_legacy_001";
const SONG_LEGACY = 50_001;

async function seedSessionFixture() {
	const { id: userId } = await seedUser({ username: "session_router_user" });

	const sessionId = `Q${"d".repeat(40)}`;
	const scoreId = "score-sess-router-test";
	const now = new Date().toISOString();

	await DB.insertInto("song")
		.values({
			id: SONG_PG,
			legacy_id: SONG_LEGACY,
			game_group: "iidx",
			title: "5.1.1.",
			artist: "dj nagureo",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "PIANO AMBIENT" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: CHART_PG,
			legacy_id: CHART_LEGACY,
			game: "iidx-sp",
			song_id: SONG_PG,
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: ["27"],
			data: { inGameID: 1000, notecount: 786 },
		})
		.execute();

	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
		grade: "AAA",
		lamp: "EX HARD CLEAR",
		percent: 90,
		score: 1400,
		optional: {},
		judgements: {},
	} as ScoreData<"iidx-sp">);

	await DB.insertInto("session")
		.values({
			id: sessionId,
			user_id: userId,
			game: "iidx-sp",
			name: "Seed Session",
			description: null,
			time_inserted: now,
			time_started: now,
			time_ended: now,
			calculated_data: JSON.stringify({}),
			highlight: false,
		})
		.execute();

	await DB.insertInto("score")
		.values({
			id: scoreId,
			user_id: userId,
			chart_id: CHART_PG,
			game: "iidx-sp",
			session_id: sessionId,
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

	return { userId, sessionId, scoreId };
}

describe("GET /api/v1/sessions/:sessionID", () => {
	it("returns 404 when the session does not exist", async () => {
		const res = await mockApi.get("/api/v1/sessions/nonexistent_session_id_xxxxxxxx");

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns session, scores, songs, charts, user, and scoreInfo", async () => {
		const { sessionId, scoreId, userId } = await seedSessionFixture();

		const res = await mockApi.get(`/api/v1/sessions/${sessionId}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.session.sessionID).toBe(sessionId);
		expect(res.body.body.scores).toHaveLength(1);
		expect(res.body.body.scores[0].scoreID).toBe(scoreId);
		expect(res.body.body.charts).toHaveLength(1);
		expect(res.body.body.charts[0].chartID).toBe(CHART_PG);
		expect(res.body.body.songs).toHaveLength(1);
		expect(res.body.body.songs[0].id).toBe(SONG_PG);
		expect(res.body.body.user.id).toBe(userId);
		expect(res.body.body.scoreInfo).toHaveLength(1);
		expect(res.body.body.scoreInfo[0].scoreID).toBe(scoreId);
		expect(res.body.body.scoreInfo[0].isNewScore).toBe(true);
	});
});

describe("GET /api/v1/sessions/:sessionID/folder-raises", () => {
	it("returns folder raise rows when session charts appear in folder_chart_lookup", async () => {
		const { sessionId } = await seedSessionFixture();
		const folderId = `F_folder_sess_${sessionId}`;

		await DB.insertInto("folder")
			.values({
				id: folderId,
				legacy_id: folderId,
				game: "iidx-sp",
				inactive: false,
				title: "Session Folder Raises Test",
				slug: folderId,
				where: `chart.id = '${CHART_PG}'`,
				version_filter: null,
				search_terms: [],
			})
			.execute();

		await DB.insertInto("folder_chart_lookup")
			.values({ folder_id: folderId, chart_id: CHART_PG })
			.execute();

		const res = await mockApi.get(`/api/v1/sessions/${sessionId}/folder-raises`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.body)).toBe(true);
		expect(res.body.body.length).toBeGreaterThan(0);

		const hit = res.body.body.find(
			(r: { folder: { folderID: string } }) => r.folder.folderID === folderId,
		);

		expect(hit).toBeDefined();
		expect(hit.raisedCharts).toContain(CHART_PG);
		expect(hit.totalCharts).toBeGreaterThanOrEqual(1);
		expect(typeof hit.type).toBe("string");
		expect(typeof hit.value).toBe("string");
	});

	it("treats raises cumulatively (an EX HARD CLEAR is also a HARD CLEAR)", async () => {
		const { sessionId } = await seedSessionFixture();
		const folderId = `F_folder_sess_cumulative_${sessionId}`;

		await DB.insertInto("folder")
			.values({
				id: folderId,
				legacy_id: folderId,
				game: "iidx-sp",
				inactive: false,
				title: "Session Folder Cumulative Test",
				slug: folderId,
				where: `chart.id = '${CHART_PG}'`,
				version_filter: null,
				search_terms: [],
			})
			.execute();

		await DB.insertInto("folder_chart_lookup")
			.values({ folder_id: folderId, chart_id: CHART_PG })
			.execute();

		const res = await mockApi.get(`/api/v1/sessions/${sessionId}/folder-raises`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const lampRows = (
			res.body.body as Array<{
				folder: { folderID: string };
				raisedCharts: Array<string>;
				type: string;
				value: string;
			}>
		).filter((r) => r.folder.folderID === folderId && r.type === "lamp");

		// The seeded score is an EX HARD CLEAR, so it should raise the EX HARD
		// CLEAR bucket *and* the HARD CLEAR (and CLEAR) value-or-better buckets.
		const exhc = lampRows.find((r) => r.value === "EX HARD CLEAR");
		const hc = lampRows.find((r) => r.value === "HARD CLEAR");

		expect(exhc).toBeDefined();
		expect(exhc?.raisedCharts).toContain(CHART_PG);
		expect(hc).toBeDefined();
		expect(hc?.raisedCharts).toContain(CHART_PG);
	});
});

describe("GET /api/v1/sessions/:sessionID/adjacent", () => {
	async function seedThreeSessions() {
		const { id: userId } = await seedUser({ username: "adjacent_user" });

		const sessionIds = ["adj_session_oldest", "adj_session_middle", "adj_session_newest"];

		for (const [i, id] of sessionIds.entries()) {
			const t = new Date(2024, 0, 1 + i).toISOString();

			await DB.insertInto("session")
				.values({
					id,
					user_id: userId,
					game: "iidx-sp",
					name: `Session ${i}`,
					description: null,
					time_inserted: t,
					time_started: t,
					time_ended: t,
					calculated_data: JSON.stringify({}),
					highlight: false,
				})
				.execute();
		}

		return { userId, sessionIds };
	}

	it("returns both neighbors for the middle session", async () => {
		const { sessionIds } = await seedThreeSessions();

		const res = await mockApi.get(`/api/v1/sessions/${sessionIds[1]}/adjacent`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.prev?.sessionID).toBe(sessionIds[0]);
		expect(res.body.body.next?.sessionID).toBe(sessionIds[2]);
	});

	it("returns null next for the newest session", async () => {
		const { sessionIds } = await seedThreeSessions();

		const res = await mockApi.get(`/api/v1/sessions/${sessionIds[2]}/adjacent`);

		expect(res.status).toBe(200);
		expect(res.body.body.next).toBeNull();
		expect(res.body.body.prev?.sessionID).toBe(sessionIds[1]);
	});

	it("returns null prev for the oldest session", async () => {
		const { sessionIds } = await seedThreeSessions();

		const res = await mockApi.get(`/api/v1/sessions/${sessionIds[0]}/adjacent`);

		expect(res.status).toBe(200);
		expect(res.body.body.prev).toBeNull();
		expect(res.body.body.next?.sessionID).toBe(sessionIds[1]);
	});
});

describe("PATCH /api/v1/sessions/:sessionID", () => {
	it("updates the session name when authorised", async () => {
		const { sessionId, userId } = await seedSessionFixture();

		await seedApiToken({
			token: "sess_patch_token",
			userId,
			customiseSession: true,
		});

		const res = await mockApi
			.patch(`/api/v1/sessions/${sessionId}`)
			.set("Authorization", "Bearer sess_patch_token")
			.send({ name: "patched_name" });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual({});

		const row = await DB.selectFrom("session")
			.select("name")
			.where("id", "=", sessionId)
			.executeTakeFirst();

		expect(row?.name).toBe("patched_name");
	});

	it("returns 400 for an empty PATCH body", async () => {
		const { sessionId, userId } = await seedSessionFixture();

		await seedApiToken({
			token: "sess_patch_token",
			userId,
			customiseSession: true,
		});

		const res = await mockApi
			.patch(`/api/v1/sessions/${sessionId}`)
			.set("Authorization", "Bearer sess_patch_token")
			.send({});

		expect(res.status).toBe(400);
	});
});
