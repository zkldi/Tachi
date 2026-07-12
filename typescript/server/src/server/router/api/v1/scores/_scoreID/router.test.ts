import { seedApiToken } from "#actions/test-utils/api-tokens";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { type ScoreData } from "tachi-common";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

async function seedTestingIidxScore() {
	await seedUser({ username: "score_owner", withCredential: true, withSettings: true });

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
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
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
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: Testing511SPA.data,
		})
		.execute();

	await DB.insertInto("score")
		.values({
			id: TestingIIDXSPScore.scoreID,
			user_id: 1,
			chart_id: chartId,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(TestingIIDXSPScore.calculatedData),
			meta: JSON.stringify({}),
			time_achieved: new Date(TestingIIDXSPScore.timeAchieved ?? Date.now()).toISOString(),
			time_added: now,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("GET /api/v1/scores/:scoreID", () => {
	beforeEach(seedTestingIidxScore);

	it("returns the score at that id", async () => {
		const res = await mockApi.get("/api/v1/scores/TESTING_SCORE_ID");

		expect(res.status).toBe(200);
		expect(res.body.body.score.scoreID).toBe("TESTING_SCORE_ID");
	});

	it("returns related user, chart, and song when getRelated=true", async () => {
		const res = await mockApi.get("/api/v1/scores/TESTING_SCORE_ID?getRelated=true");

		expect(res.status).toBe(200);
		expect(res.body.body.score.scoreID).toBe("TESTING_SCORE_ID");
		expect(res.body.body.user.id).toBe(1);
		expect(res.body.body.chart.chartID).toBe(Testing511SPA.chartID);
		expect(res.body.body.song.id).toBe(Testing511Song.id);
	});

	it("returns 404 when the score does not exist", async () => {
		const res = await mockApi.get("/api/v1/scores/not_real");

		expect(res.status).toBe(404);
	});
});

describe("PATCH /api/v1/scores/:scoreID", () => {
	beforeEach(async () => {
		await seedTestingIidxScore();
		await seedApiToken({
			token: "fake_api_token",
			userId: 1,
			identifier: "sc",
			submitScore: false,
		});
		await DB.updateTable("priv_api_token")
			.set({ pm_customise_score: true })
			.where("priv_api_token.token", "=", "fake_api_token")
			.execute();
	});

	it("updates comment and persists", async () => {
		await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer fake_api_token")
			.send({ comment: "hello_world" });

		const row = await DB.selectFrom("score")
			.select("comment")
			.where("id", "=", "TESTING_SCORE_ID")
			.executeTakeFirstOrThrow();

		expect(row.comment).toBe("hello_world");
	});

	it("updates highlight and persists", async () => {
		await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer fake_api_token")
			.send({ highlight: true });

		const row = await DB.selectFrom("score")
			.select("highlight")
			.where("id", "=", "TESTING_SCORE_ID")
			.executeTakeFirstOrThrow();

		expect(row.highlight).toBe(true);
	});

	it("clears comment to null", async () => {
		await DB.updateTable("score")
			.set({ comment: "x" })
			.where("id", "=", "TESTING_SCORE_ID")
			.execute();

		await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer fake_api_token")
			.send({ comment: null });

		const row = await DB.selectFrom("score")
			.select("comment")
			.where("id", "=", "TESTING_SCORE_ID")
			.executeTakeFirstOrThrow();

		expect(row.comment).toBeNull();
	});

	it("returns 400 for invalid comment length", async () => {
		const res = await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer fake_api_token")
			.send({ comment: "" });

		expect(res.status).toBe(400);
		expect(String(res.body.description).toLowerCase()).toMatch(/comment/u);

		const res2 = await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer fake_api_token")
			.send({ comment: "a".repeat(121) });

		expect(res2.status).toBe(400);
		expect(String(res2.body.description).toLowerCase()).toMatch(/comment/u);
	});

	it("returns 400 for an empty body", async () => {
		const res = await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer fake_api_token")
			.send({});

		expect(res.status).toBe(400);
	});

	it("returns 403 when the token is for another user", async () => {
		await seedUser({ username: "other_sc" });
		await seedApiToken({
			token: "some_dude",
			userId: 2,
			identifier: "x",
			submitScore: false,
		});
		await DB.updateTable("priv_api_token")
			.set({ pm_customise_score: true })
			.where("priv_api_token.token", "=", "some_dude")
			.execute();

		const res = await mockApi
			.patch("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer some_dude")
			.send({ comment: "foo" });

		expect(res.status).toBe(403);
		expect(String(res.body.description)).toMatch(/not authorised/iu);
	});

	it.todo("enforce customise_score API token permission (not enforced on this route today)");
});

describe("DELETE /api/v1/scores/:scoreID", () => {
	beforeEach(seedTestingIidxScore);

	it("deletes the score when authorised", async () => {
		await seedApiToken({
			token: "foo",
			userId: 1,
			identifier: "del",
			submitScore: false,
		});
		await DB.updateTable("priv_api_token")
			.set({ pm_delete_score: true })
			.where("priv_api_token.token", "=", "foo")
			.execute();

		const res = await mockApi
			.delete("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer foo");

		expect(res.status).toBe(200);

		const row = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", "TESTING_SCORE_ID")
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});

	it("returns 403 for another user even with delete_score", async () => {
		await seedUser({ username: "other_del" });
		await seedApiToken({
			token: "some_dude",
			userId: 2,
			identifier: "sd",
			submitScore: false,
		});
		await DB.updateTable("priv_api_token")
			.set({ pm_delete_score: true })
			.where("priv_api_token.token", "=", "some_dude")
			.execute();

		const res = await mockApi
			.delete("/api/v1/scores/TESTING_SCORE_ID")
			.set("Authorization", "Bearer some_dude");

		expect(res.status).toBe(403);
	});

	it.todo("enforce delete_score API token permission (not enforced on this route today)");

	it("allows an admin to delete another user's score via session", async () => {
		await DB.updateTable("account").set({ auth_level: "admin" }).where("id", "=", 1).execute();

		const loginRes = await mockApi.post("/api/v1/auth/login").send({
			username: "score_owner",
			"!password": "password123",
			captcha: "test",
		});

		expect(loginRes.status).toBe(200);

		const cookie = loginRes.headers["set-cookie"] as unknown as string[];

		await seedUser({ username: "other_score" });
		const sd = TestingIIDXSPScore.scoreData as ScoreData<"iidx-sp">;
		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", sd);
		const now = new Date().toISOString();

		await DB.insertInto("score")
			.values({
				id: "someone_elses",
				user_id: 2,
				chart_id: Testing511SPA.chartID,
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

		const res = await mockApi.delete("/api/v1/scores/someone_elses").set("Cookie", cookie);

		expect(res.status).toBe(200);

		const row = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", "someone_elses")
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});
});
