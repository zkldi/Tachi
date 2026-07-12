import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { type ScoreData } from "tachi-common";
import { afterAll, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

describe("POST /api/v1/admin/delete-score", () => {
	it("returns 403 when the caller is not an admin", async () => {
		await seedUser({
			username: "pleb",
			email: "pleb@test.com",
			withCredential: true,
			withSettings: true,
		});

		const plebCookie = await loginAs("pleb");

		const res = await mockApi
			.post("/api/v1/admin/delete-score")
			.set("Cookie", plebCookie)
			.send({ scoreID: "anything" });

		expect(res.status).toBe(403);
	});

	it("deletes another user's score when the caller is an admin", async () => {
		await seedUser({
			username: "admin_del",
			email: "admin_del@test.com",
			authLevel: "admin",
			withCredential: true,
			withSettings: true,
		});
		await seedUser({
			username: "victim",
			email: "victim_adm@test.com",
			withCredential: true,
			withSettings: true,
		});

		const adminCookie = await loginAs("admin_del");

		const chartId = Testing511SPA.chartID;
		const sd = TestingIIDXSPScore.scoreData as ScoreData<"iidx-sp">;
		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", sd);
		const now = new Date().toISOString();

		await DB.insertInto("song")
			.values({
				id: Testing511Song.id,
				legacy_id: 1,
				game_group: "iidx",
				title: Testing511Song.title,
				artist: Testing511Song.artist,
				search_terms: [],
				alt_titles: [],
				data: Testing511Song.data,
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartId,
				game: "iidx-sp",
				song_id: Testing511Song.id,
				difficulty: Testing511SPA.difficulty,
				level: Testing511SPA.level,
				level_num: Testing511SPA.levelNum,
				is_primary: true,
				versions: Testing511SPA.versions,
				data: Testing511SPA.data,
			})
			.execute();

		await DB.insertInto("score")
			.values({
				id: "deleteme",
				user_id: 2,
				chart_id: chartId,
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

		const res = await mockApi
			.post("/api/v1/admin/delete-score")
			.set("Cookie", adminCookie)
			.send({ scoreID: "deleteme" });

		expect(res.status).toBe(200);

		const row = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", "deleteme")
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});
});

describe("POST /api/v1/admin/recalc", () => {
	it("returns 403 when the caller is not an admin", async () => {
		await seedUser({
			username: "recalc_pleb",
			email: "recalc_pleb@test.com",
			withCredential: true,
			withSettings: true,
		});

		const plebCookie = await loginAs("recalc_pleb");

		const res = await mockApi.post("/api/v1/admin/recalc").set("Cookie", plebCookie).send({});

		expect(res.status).toBe(403);
	});

	it("enqueues every chart for score re-derivation when the caller is an admin", async () => {
		await seedUser({
			username: "recalc_admin",
			email: "recalc_admin@test.com",
			authLevel: "admin",
			withCredential: true,
			withSettings: true,
		});

		const adminCookie = await loginAs("recalc_admin");
		const chartId = Testing511SPA.chartID;

		await DB.insertInto("song")
			.values({
				id: Testing511Song.id,
				legacy_id: 1,
				game_group: "iidx",
				title: Testing511Song.title,
				artist: Testing511Song.artist,
				search_terms: [],
				alt_titles: [],
				data: Testing511Song.data,
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartId,
				game: "iidx-sp",
				song_id: Testing511Song.id,
				difficulty: Testing511SPA.difficulty,
				level: Testing511SPA.level,
				level_num: Testing511SPA.levelNum,
				is_primary: true,
				versions: Testing511SPA.versions,
				data: Testing511SPA.data,
			})
			.execute();

		const res = await mockApi.post("/api/v1/admin/recalc").set("Cookie", adminCookie).send({});

		expect(res.status).toBe(200);

		const stillQueued = await DB.selectFrom("score_rederive")
			.select("chart_id")
			.where("chart_id", "=", chartId)
			.executeTakeFirst();

		expect(stillQueued).toBeUndefined();
	});
});

describe("POST /api/v1/admin/recalc-profiles", () => {
	it("returns 403 when the caller is not an admin", async () => {
		await seedUser({
			username: "prof_pleb",
			email: "prof_pleb@test.com",
			withCredential: true,
			withSettings: true,
		});

		const plebCookie = await loginAs("prof_pleb");

		const res = await mockApi
			.post("/api/v1/admin/recalc-profiles")
			.set("Cookie", plebCookie)
			.send({});

		expect(res.status).toBe(403);
	});

	it("drains game_profile_dirty when the caller is an admin", async () => {
		const { id: adminId } = await seedUser({
			username: "prof_admin",
			email: "prof_admin@test.com",
			authLevel: "admin",
			withCredential: true,
			withSettings: true,
		});

		const adminCookie = await loginAs("prof_admin");

		await DB.insertInto("game_profile_dirty")
			.values({ user_id: adminId, game: "iidx-sp" })
			.onConflict((oc) => oc.doNothing())
			.execute();

		const res = await mockApi
			.post("/api/v1/admin/recalc-profiles")
			.set("Cookie", adminCookie)
			.send({});

		expect(res.status).toBe(200);

		const stillQueued = await DB.selectFrom("game_profile_dirty")
			.select("game_profile_dirty.user_id")
			.where("game_profile_dirty.user_id", "=", adminId)
			.where("game_profile_dirty.game", "=", "iidx-sp")
			.executeTakeFirst();

		expect(stillQueued).toBeUndefined();
	});
});

describe("POST /api/v1/admin/recalc-pbs", () => {
	it("returns 403 when the caller is not an admin", async () => {
		await seedUser({
			username: "recalc_pb_pleb",
			email: "recalc_pb_pleb@test.com",
			withCredential: true,
			withSettings: true,
		});

		const plebCookie = await loginAs("recalc_pb_pleb");

		const res = await mockApi
			.post("/api/v1/admin/recalc-pbs")
			.set("Cookie", plebCookie)
			.send({});

		expect(res.status).toBe(403);
	});

	it("enqueues pb_dirty for every distinct user+chart from scores when the caller is an admin", async () => {
		await seedUser({
			username: "recalc_pb_admin",
			email: "recalc_pb_admin@test.com",
			authLevel: "admin",
			withCredential: true,
			withSettings: true,
		});
		await seedUser({
			username: "recalc_pb_player",
			email: "recalc_pb_player@test.com",
			withCredential: true,
			withSettings: true,
		});

		const adminCookie = await loginAs("recalc_pb_admin");
		const chartId = Testing511SPA.chartID;
		const sd = TestingIIDXSPScore.scoreData as ScoreData<"iidx-sp">;
		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", sd);
		const now = new Date().toISOString();

		await DB.insertInto("song")
			.values({
				id: Testing511Song.id,
				legacy_id: 1,
				game_group: "iidx",
				title: Testing511Song.title,
				artist: Testing511Song.artist,
				search_terms: [],
				alt_titles: [],
				data: Testing511Song.data,
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartId,
				game: "iidx-sp",
				song_id: Testing511Song.id,
				difficulty: Testing511SPA.difficulty,
				level: Testing511SPA.level,
				level_num: Testing511SPA.levelNum,
				is_primary: true,
				versions: Testing511SPA.versions,
				data: Testing511SPA.data,
			})
			.execute();

		await DB.insertInto("score")
			.values({
				id: "recalc_pb_score",
				user_id: 2,
				chart_id: chartId,
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

		const res = await mockApi
			.post("/api/v1/admin/recalc-pbs")
			.set("Cookie", adminCookie)
			.send({});

		expect(res.status).toBe(200);

		const stillDirty = await DB.selectFrom("pb_dirty")
			.select(["pb_dirty.user_id", "pb_dirty.chart_id"])
			.where("pb_dirty.user_id", "=", 2)
			.where("pb_dirty.chart_id", "=", chartId)
			.executeTakeFirst();

		expect(stillDirty).toBeUndefined();
	});
});

describe("POST /api/v1/admin/change-log-level", () => {
	it.todo("no route in router.ts (see router.oldtest.ts)");
});
