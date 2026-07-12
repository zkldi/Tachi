import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import {
	TestingBarbatosScore,
	TestingSDVXAlbidaChart,
	TestingSDVXAlbidaSong,
} from "#test-utils/test-data";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const MOCK_TOKEN = "mock_token";

async function seedBarbatosSdvxChart() {
	await DB.insertInto("song")
		.values({
			id: TestingSDVXAlbidaSong.id,
			legacy_id: 1,
			game_group: "sdvx",
			title: TestingSDVXAlbidaSong.title,
			artist: TestingSDVXAlbidaSong.artist,
			search_terms: TestingSDVXAlbidaSong.searchTerms,
			alt_titles: TestingSDVXAlbidaSong.altTitles,
			data: TestingSDVXAlbidaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingSDVXAlbidaChart.chartID,
			legacy_id: TestingSDVXAlbidaChart.chartID,
			game: "sdvx",
			song_id: TestingSDVXAlbidaSong.id,
			difficulty: TestingSDVXAlbidaChart.difficulty,
			level: TestingSDVXAlbidaChart.level,
			level_num: TestingSDVXAlbidaChart.levelNum,
			is_primary: TestingSDVXAlbidaChart.isPrimary,
			versions: TestingSDVXAlbidaChart.versions,
			data: TestingSDVXAlbidaChart.data,
		})
		.execute();
}

afterAll(() => CloseServerConnection());

describe("POST /ir/barbatos/score/submit (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "barbatos-ir@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: MOCK_TOKEN,
			userId: 1,
			submitScore: true,
		});
		await seedBarbatosSdvxChart();
	});

	it("imports a valid score", async () => {
		const res = await mockApi
			.post("/ir/barbatos/score/submit")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.send(TestingBarbatosScore);

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors.length).toBe(0);

		const row = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("user_id", "=", 1)
			.where("game", "=", "sdvx")
			.executeTakeFirst();

		expect(Number(row?.c)).toBe(1);
	});

	it("rejects an invalid body", async () => {
		const res = await mockApi
			.post("/ir/barbatos/score/submit")
			.set("Authorization", `Bearer ${MOCK_TOKEN}`)
			.send({});

		expect(res.body.success).toBe(false);
		expect(res.status).toBe(400);
	});

	it("requires authorization", async () => {
		const res = await mockApi.post("/ir/barbatos/score/submit").send(TestingBarbatosScore);

		expect(res.statusCode).toBe(401);
	});

	it("rejects invalid tokens", async () => {
		const res = await mockApi
			.post("/ir/barbatos/score/submit")
			.set("Authorization", "Bearer invalid_token")
			.send(TestingBarbatosScore);

		expect(res.statusCode).toBe(401);
	});
});
