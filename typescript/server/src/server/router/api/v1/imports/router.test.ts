import { ServerConfig } from "#lib/setup/config";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import {
	FakeImport,
	Testing511Song,
	Testing511SPA,
	TestingIIDXSPScore,
} from "#test-utils/test-data";
import { type ScoreData } from "tachi-common";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

async function seedFakeImportFixture() {
	await seedUser({
		username: "import_owner",
		email: "import_owner@test.com",
		withCredential: true,
		withSettings: true,
	});

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

	await DB.insertInto("import")
		.values({
			id: FakeImport.importID,
			user_id: 1,
			time_started: new Date(FakeImport.timeStarted).toISOString(),
			time_finished: new Date(FakeImport.timeFinished).toISOString(),
			game_group: "iidx",
			import_type: "ir/direct-manual",
			user_intent: FakeImport.userIntent,
			service: "test",
			status: "completed",
		})
		.execute();

	await DB.insertInto("score")
		.values({
			id: FakeImport.scoreIDs[0],
			user_id: 1,
			chart_id: chartId,
			game: "iidx-sp",
			session_id: null,
			import_id: FakeImport.importID,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(TestingIIDXSPScore.calculatedData),
			meta: JSON.stringify({}),
			time_achieved: now,
			time_added: now,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("GET /api/v1/imports/:importID", () => {
	beforeEach(seedFakeImportFixture);

	it("returns the import and related entities", async () => {
		const res = await mockApi.get(`/api/v1/imports/${FakeImport.importID}`);

		expect(res.status).toBe(200);
		expect(res.body.body.import.importID).toBe(FakeImport.importID);
		expect(res.body.body.user.id).toBe(1);
		expect(
			res.body.body.scores.some(
				(s: { scoreID: string }) => s.scoreID === FakeImport.scoreIDs[0],
			),
		).toBe(true);
	});

	it("returns 404 when the import does not exist", async () => {
		const res = await mockApi.get("/api/v1/imports/bad-import");

		expect(res.status).toBe(404);
	});
});

describe("POST /api/v1/imports/:importID/revert", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedFakeImportFixture();
		cookie = await loginAs("import_owner");
	});

	it("reverts an import and removes its scores", async () => {
		const res = await mockApi
			.post(`/api/v1/imports/${FakeImport.importID}/revert`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);

		const score = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", FakeImport.scoreIDs[0])
			.executeTakeFirst();

		expect(score).toBeUndefined();
	});

	it("returns 404 when the import does not exist", async () => {
		const res = await mockApi.post(`/api/v1/imports/doesnt-exist/revert`).set("Cookie", cookie);

		expect(res.status).toBe(404);
	});

	it("returns 401 without auth", async () => {
		const res = await mockApi.post(`/api/v1/imports/${FakeImport.importID}/revert`);

		expect(res.status).toBe(401);
	});

	it("returns 403 when reverting someone else's import", async () => {
		await seedUser({
			username: "other_imp",
			email: "other_imp@test.com",
			withCredential: true,
			withSettings: true,
		});
		await DB.insertInto("import")
			.values({
				id: "someone_elses",
				user_id: 2,
				time_started: new Date().toISOString(),
				time_finished: new Date().toISOString(),
				game_group: "iidx",
				import_type: "ir/direct-manual",
				user_intent: true,
				service: "test",
				status: "completed",
			})
			.execute();

		const res = await mockApi
			.post("/api/v1/imports/someone_elses/revert")
			.set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("allows an admin to revert another user's import", async () => {
		await seedUser({
			username: "adm_imp",
			email: "adm_imp@test.com",
			authLevel: "admin",
			withCredential: true,
			withSettings: true,
		});
		await DB.insertInto("import")
			.values({
				id: "someone_elses2",
				user_id: 2,
				time_started: new Date().toISOString(),
				time_finished: new Date().toISOString(),
				game_group: "iidx",
				import_type: "ir/direct-manual",
				user_intent: true,
				service: "test",
				status: "completed",
			})
			.execute();

		const adminCookie = await loginAs("adm_imp");

		const res = await mockApi
			.post("/api/v1/imports/someone_elses2/revert")
			.set("Cookie", adminCookie);

		expect(res.status).toBe(200);
	});
});

describe("GET /api/v1/imports (list)", () => {
	it.todo("port list behaviour from router.oldtest todo");
});

describe("GET /api/v1/imports/failed", () => {
	it.todo("port failed-import list from router.oldtest todo");
});

describe("GET /api/v1/imports/:importID/poll-status", () => {
	let originalWorkerSetting: boolean;

	beforeEach(async () => {
		originalWorkerSetting = ServerConfig.USE_EXTERNAL_SCORE_IMPORT_WORKER;
		ServerConfig.USE_EXTERNAL_SCORE_IMPORT_WORKER = true;
	});

	afterEach(() => {
		ServerConfig.USE_EXTERNAL_SCORE_IMPORT_WORKER = originalWorkerSetting;
	});

	it("returns 501 when external worker is disabled", async () => {
		ServerConfig.USE_EXTERNAL_SCORE_IMPORT_WORKER = false;

		const res = await mockApi.get("/api/v1/imports/some-import/poll-status");

		expect(res.status).toBe(501);
	});

	it("returns 404 when no import, tracker, or job exists", async () => {
		const res = await mockApi.get("/api/v1/imports/nonexistent/poll-status");

		expect(res.status).toBe(404);
	});

	it("returns ongoing when import stub exists but status is in_progress", async () => {
		await seedUser({ username: "poll_user" });

		await DB.insertInto("import")
			.values({
				id: "in-progress-import",
				user_id: 1,
				time_started: new Date().toISOString(),
				time_finished: new Date().toISOString(),
				game_group: "iidx",
				import_type: "ir/direct-manual",
				user_intent: true,
				service: "test",
				status: "in_progress",
			})
			.execute();

		const res = await mockApi.get("/api/v1/imports/in-progress-import/poll-status");

		expect(res.status).toBe(200);
		expect(res.body.body.importStatus).toBe("ongoing");
	});

	it("returns completed when import status is completed", async () => {
		await seedFakeImportFixture();

		const res = await mockApi.get(`/api/v1/imports/${FakeImport.importID}/poll-status`);

		expect(res.status).toBe(200);
		expect(res.body.body.importStatus).toBe("completed");
		expect(res.body.body.import.importID).toBe(FakeImport.importID);
	});

	it("returns 400 with success false when import_tracker records a failure", async () => {
		const { id: userID } = await seedUser({ username: "poll_failed_user" });

		await DB.insertInto("import_tracker")
			.values({
				import_id: "failed-import",
				user_id: userID,
				import_type: "file/batch-manual",
				user_intent: true,
				time_started: new Date().toISOString(),
				error: { message: "Invalid score file.", statusCode: 400 },
			})
			.execute();

		const res = await mockApi.get("/api/v1/imports/failed-import/poll-status");

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
		expect(res.body.description).toBe("Invalid score file.");
	});
});
