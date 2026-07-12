import { ONE_MONTH } from "#lib/constants/time";
import DB from "#services/pg/db";
import mockApi from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { describe, expect, it } from "vitest";

// ─── helpers ─────────────────────────────────────────────────────────────────

let importCounter = 0;
let entityCounter = 0;

async function seedSongAndChart() {
	const id = `entity-${++entityCounter}`;

	await DB.insertInto("song")
		.values({
			id,
			legacy_id: entityCounter,
			game_group: "iidx",
			title: "Test Song",
			artist: "Test Artist",
			search_terms: [],
			alt_titles: [],
			data: JSON.stringify({}),
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id,
			legacy_id: id,
			game: "iidx-sp",
			song_id: id,
			level: "12",
			level_num: 12,
			is_primary: true,
			difficulty: "ANOTHER",
			versions: [],
			data: JSON.stringify({}),
		})
		.execute();

	return id;
}

async function seedScore(userId: number) {
	const chartId = await seedSongAndChart();
	const id = `score-${++entityCounter}`;

	await DB.insertInto("score")
		.values({
			id,
			user_id: userId,
			chart_id: chartId,
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
}

async function seedSession(userId: number) {
	const id = `session-${++entityCounter}`;
	const now = new Date().toISOString();

	await DB.insertInto("session")
		.values({
			id,
			user_id: userId,
			game: "iidx-sp",
			name: "Test Session",
			description: null,
			time_inserted: now,
			time_started: now,
			time_ended: now,
			calculated_data: JSON.stringify({}),
			highlight: false,
		})
		.execute();
}

async function seedImport(
	userId: number,
	importType: string,
	opts: { ageMs?: number; userIntent?: boolean } = {},
) {
	const { ageMs = 0, userIntent = true } = opts;
	const finishedAt = new Date(Date.now() - ageMs).toISOString();

	await DB.insertInto("import")
		.values({
			id: `import-${++importCounter}`,
			user_id: userId,
			time_started: finishedAt,
			time_finished: finishedAt,
			game_group: "iidx",
			import_type: importType as never,
			user_intent: userIntent,
			service: "test",
			status: "completed",
		})
		.execute();
}

// ─── GET /api/v1/users/:userID/recent-imports ─────────────────────────────────

describe("GET /api/v1/users/:userID/recent-imports", () => {
	it("returns 200 with an empty array when the user has no imports", async () => {
		const { id } = await seedUser();

		const res = await mockApi.get(`/api/v1/users/${id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual([]);
	});

	it("returns 404 when the user does not exist", async () => {
		const res = await mockApi.get("/api/v1/users/99999/recent-imports");

		expect(res.status).toBe(404);
	});

	it("returns import types with counts for recent imports", async () => {
		const { id } = await seedUser();
		await seedImport(id, "file/batch-manual");
		await seedImport(id, "file/batch-manual");
		await seedImport(id, "ir/fervidex");

		const res = await mockApi.get(`/api/v1/users/${id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(2);

		const batchManual = res.body.body.find(
			(e: { importType: string }) => e.importType === "file/batch-manual",
		);
		const fervidex = res.body.body.find(
			(e: { importType: string }) => e.importType === "ir/fervidex",
		);

		expect(batchManual).toEqual({ importType: "file/batch-manual", count: 2 });
		expect(fervidex).toEqual({ importType: "ir/fervidex", count: 1 });
	});

	it("returns results sorted by count descending", async () => {
		const { id } = await seedUser();
		await seedImport(id, "ir/fervidex");
		await seedImport(id, "file/batch-manual");
		await seedImport(id, "file/batch-manual");
		await seedImport(id, "file/batch-manual");

		const res = await mockApi.get(`/api/v1/users/${id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.body[0].importType).toBe("file/batch-manual");
		expect(res.body.body[0].count).toBe(3);
		expect(res.body.body[1].importType).toBe("ir/fervidex");
		expect(res.body.body[1].count).toBe(1);
	});

	it("excludes mypagescraper import types", async () => {
		const { id } = await seedUser();
		await seedImport(id, "file/mypagescraper-records-csv");
		await seedImport(id, "file/mypagescraper-player-csv");
		await seedImport(id, "file/batch-manual");

		const res = await mockApi.get(`/api/v1/users/${id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].importType).toBe("file/batch-manual");
	});

	it("excludes imports older than one month", async () => {
		const { id } = await seedUser();
		await seedImport(id, "file/batch-manual", { ageMs: ONE_MONTH + 1000 });
		await seedImport(id, "ir/fervidex");

		const res = await mockApi.get(`/api/v1/users/${id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].importType).toBe("ir/fervidex");
	});

	it("excludes imports where user_intent is false", async () => {
		const { id } = await seedUser();
		await seedImport(id, "ir/fervidex", { userIntent: false });
		await seedImport(id, "file/batch-manual");

		const res = await mockApi.get(`/api/v1/users/${id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].importType).toBe("file/batch-manual");
	});

	it("does not include imports from other users", async () => {
		const user1 = await seedUser({ username: "user_one" });
		const user2 = await seedUser({ username: "user_two" });
		await seedImport(user2.id, "file/batch-manual");

		const res = await mockApi.get(`/api/v1/users/${user1.id}/recent-imports`);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual([]);
	});
});

// ─── GET /api/v1/users/:userID/stats ─────────────────────────────────────────

describe("GET /api/v1/users/:userID/stats", () => {
	it("returns 404 when the user does not exist", async () => {
		const res = await mockApi.get("/api/v1/users/99999/stats");

		expect(res.status).toBe(404);
	});

	it("returns zeros when the user has no scores or sessions", async () => {
		const { id } = await seedUser();

		const res = await mockApi.get(`/api/v1/users/${id}/stats`);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual({ scores: 0, sessions: 0 });
	});

	it("counts scores correctly", async () => {
		const { id } = await seedUser();
		await seedScore(id);
		await seedScore(id);

		const res = await mockApi.get(`/api/v1/users/${id}/stats`);

		expect(res.status).toBe(200);
		expect(res.body.body.scores).toBe(2);
		expect(res.body.body.sessions).toBe(0);
	});

	it("counts sessions correctly", async () => {
		const { id } = await seedUser();
		await seedSession(id);

		const res = await mockApi.get(`/api/v1/users/${id}/stats`);

		expect(res.status).toBe(200);
		expect(res.body.body.scores).toBe(0);
		expect(res.body.body.sessions).toBe(1);
	});

	it("does not count scores or sessions belonging to other users", async () => {
		const user1 = await seedUser({ username: "user_one" });
		const user2 = await seedUser({ username: "user_two" });
		await seedScore(user2.id);
		await seedSession(user2.id);

		const res = await mockApi.get(`/api/v1/users/${user1.id}/stats`);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual({ scores: 0, sessions: 0 });
	});
});
