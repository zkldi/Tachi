import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { TestingUSCChart, TestingUSCSong } from "#test-utils/test-data";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

async function seedUscControllerChart() {
	const chart = dmf(TestingUSCChart, { game: "usc-controller" } as never);

	await DB.insertInto("song")
		.values({
			id: TestingUSCSong.id,
			legacy_id: 1,
			game_group: "usc",
			title: TestingUSCSong.title,
			artist: TestingUSCSong.artist,
			search_terms: TestingUSCSong.searchTerms,
			alt_titles: TestingUSCSong.altTitles,
			data: TestingUSCSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "usc-controller",
			song_id: TestingUSCSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

afterAll(() => CloseServerConnection());

describe("GET /ir/usc/:playtype (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "usc-ir@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "usc_ir_token",
			userId: 1,
			submitScore: true,
		});
	});

	it("returns 41 for an invalid token", async () => {
		const res = await mockApi.get("/ir/usc/Controller").set("Authorization", "Bearer invalid");

		expect(res.body.statusCode).toBe(41);
	});

	it("returns 40 for a non-Bearer auth header", async () => {
		const res = await mockApi
			.get("/ir/usc/Controller")
			.set("Authorization", "NOTBEARER invalid");

		expect(res.body.statusCode).toBe(40);
	});

	it("returns 40 when Authorization is missing", async () => {
		const res = await mockApi.get("/ir/usc/Controller");

		expect(res.body.statusCode).toBe(40);
	});

	it("returns 40 for a malformed Bearer header", async () => {
		const res = await mockApi
			.get("/ir/usc/Controller")
			.set("Authorization", "Bearer usc_ir_token invalid");

		expect(res.body.statusCode).toBe(40);
	});

	it("returns heartbeat payload for Controller", async () => {
		const res = await mockApi
			.get("/ir/usc/Controller")
			.set("Authorization", "Bearer usc_ir_token");

		expect(res.body.statusCode).toBe(20);
		expect(res.body.body).toMatchObject({
			serverName: expect.stringMatching(/tachi/iu),
			irVersion: expect.stringMatching(/^[0-9]\.[0-9]\.[0-9](-a)?$/iu),
		});
	});

	it("returns heartbeat payload for Keyboard", async () => {
		const res = await mockApi
			.get("/ir/usc/Keyboard")
			.set("Authorization", "Bearer usc_ir_token");

		expect(res.body.statusCode).toBe(20);
		expect(res.body.body).toMatchObject({
			serverName: expect.stringMatching(/tachi/iu),
		});
	});
});

describe("GET /ir/usc/:playtype/charts/:chartHash (Postgres)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "usc-charts@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedApiToken({
			token: "usc_ir_token",
			userId: 1,
			submitScore: true,
		});
		await seedUscControllerChart();
	});

	it("returns 20 when the chart hash matches", async () => {
		const res = await mockApi
			.get("/ir/usc/Controller/charts/USC_CHART_HASH")
			.set("Authorization", "Bearer usc_ir_token");

		expect(res.body.statusCode).toBe(20);
	});

	it("returns 44 when the chart hash does not match any chart", async () => {
		const res = await mockApi
			.get("/ir/usc/Controller/charts/INVALID_HASH")
			.set("Authorization", "Bearer usc_ir_token");

		expect(res.body.statusCode).toBe(44);
	});
});
