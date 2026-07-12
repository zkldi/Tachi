import type { BatchManual, BatchManualScore, V3Game } from "tachi-common";

import { seedApiToken, seedUser } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import {
	CHUNITHMBBKKChart,
	CHUNITHMBBKKSong,
	FakeChunitachiBatchManual,
	FakeSmallBatchManual,
	Testing511Song,
	Testing511SPA,
} from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

async function seed511() {
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
			id: Testing511SPA.chartID,
			legacy_id: Testing511SPA.chartID,
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
}

async function seedChunithmBbkk() {
	await DB.insertInto("song")
		.values({
			id: CHUNITHMBBKKSong.id,
			legacy_id: 900_001,
			game_group: "chunithm",
			title: CHUNITHMBBKKSong.title,
			artist: CHUNITHMBBKKSong.artist,
			search_terms: CHUNITHMBBKKSong.searchTerms,
			alt_titles: CHUNITHMBBKKSong.altTitles,
			data: CHUNITHMBBKKSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: CHUNITHMBBKKChart.chartID,
			legacy_id: CHUNITHMBBKKChart.chartID,
			game: "chunithm",
			song_id: CHUNITHMBBKKSong.id,
			difficulty: CHUNITHMBBKKChart.difficulty,
			level: CHUNITHMBBKKChart.level,
			level_num: CHUNITHMBBKKChart.levelNum,
			is_primary: CHUNITHMBBKKChart.isPrimary,
			versions: CHUNITHMBBKKChart.versions,
			data: CHUNITHMBBKKChart.data,
		})
		.execute();
}

async function countScoresForGame(game: V3Game) {
	const row = await DB.selectFrom("score")
		.select((eb) => eb.fn.countAll<number>().as("c"))
		.where("user_id", "=", 1)
		.where("game", "=", game)
		.executeTakeFirst();
	return Number(row?.c ?? 0);
}

describe("POST /ir/direct-manual/import (Postgres)", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({
			username: "dm_ir_user",
			email: "dm-ir@example.com",
			withCredential: true,
			withSettings: true,
		});
		cookie = await loginAs("dm_ir_user");
		await seed511();
		await seedChunithmBbkk();
	});

	it("requires submit_score on the token", async () => {
		await seedApiToken({
			token: "foo",
			userId: 1,
			submitScore: false,
		});

		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer foo");

		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(/submit_score/iu);
	});

	it("imports BATCH-MANUAL via session cookie", async () => {
		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Cookie", cookie)
			.send(FakeSmallBatchManual);

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors.length).toBe(0);

		const n = await countScoresForGame("iidx-sp");
		expect(n).toBe(1);
	});

	it("rejects invalid BATCH-MANUAL bodies", async () => {
		const res = await mockApi.post("/ir/direct-manual/import").set("Cookie", cookie).send({});

		expect(res.body.success).toBe(false);
	});

	it("requires authentication", async () => {
		const res = await mockApi.post("/ir/direct-manual/import").send(FakeSmallBatchManual);

		expect(res.statusCode).toBe(401);
	});

	it("rejects invalid bearer tokens", async () => {
		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer invalid_token")
			.send(FakeSmallBatchManual);

		expect(res.statusCode).toBe(401);
	});

	it("imports CHUNITACHI via bearer token", async () => {
		await seedApiToken({
			token: "mock_token",
			userId: 1,
			submitScore: true,
		});

		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send(FakeChunitachiBatchManual);

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors.length).toBe(0);

		const n = await countScoresForGame("chunithm");
		expect(n).toBe(1);
	});

	it("rejects empty batch-manual with bearer token", async () => {
		await seedApiToken({
			token: "mock_token",
			userId: 1,
			submitScore: true,
		});

		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send({});

		expect(res.body.success).toBe(false);
	});
});

describe("POST /ir/direct-manual/import (end-to-end validation)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "dm_e2e",
			email: "dm-e2e@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seed511();
		await seedApiToken({
			token: "mock_token",
			userId: 1,
			submitScore: true,
		});
	});

	const baseBatchManual: BatchManual = {
		meta: {
			game: "iidx",
			playtype: "SP",
			service: "Foo",
		},
		scores: [],
	};

	it("rejects decimal scores", async () => {
		const bmScore: BatchManualScore = {
			identifier: "1",
			lamp: "CLEAR",
			matchType: "tachiSongID",
			difficulty: "ANOTHER",
			score: 123.5,
		};

		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(baseBatchManual, { scores: [bmScore] }));

		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(
			/Invalid BATCH-MANUAL: scores\[0\].score \| Expected an integer\. \| Received 123\.5/iu,
		);
	});

	it("records chart validation errors without failing the HTTP request", async () => {
		const bmScore: BatchManualScore = {
			identifier: "5.1.1.",
			lamp: "CLEAR",
			matchType: "songTitle",
			difficulty: "ANOTHER",
			score: 9000,
		};

		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(baseBatchManual, { scores: [bmScore] }));

		expect(res.body.success).toBe(true);
		expect(res.body.body.errors).toEqual([
			{
				type: "InvalidDatapoint",
				message: `Got 2 errors when validating score:
Invalid value for score, EX Score cannot be greater than 1572 for this chart. Got 9000.
Invalid value for percent, Expected a number between 0 and 100. Got 572.5190839694657.`,
			},
		]);
	});

	it("rejects out-of-range jubeat scores", async () => {
		const bmScore: BatchManualScore = {
			identifier: "1",
			lamp: "CLEAR",
			matchType: "tachiSongID",
			difficulty: "EXT",
			score: -100,
			musicRate: 50,
		};

		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send(
				deepmerge(baseBatchManual, {
					scores: [bmScore],
					meta: {
						game: "jubeat",
						playtype: "Single",
					},
				}),
			);

		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toBe(
			"Invalid BATCH-MANUAL: scores[0].score | Expected a number between 0 and 1000000. | Received -100 [type: number].",
		);
	});

	it("rejects unknown games", async () => {
		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(baseBatchManual, { meta: { game: "nonsense" } }));

		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(/Invalid game group 'nonsense'/iu);
	});

	it("rejects unknown playtypes", async () => {
		const res = await mockApi
			.post("/ir/direct-manual/import")
			.set("Authorization", "Bearer mock_token")
			.send(deepmerge(baseBatchManual, { meta: { playtype: "nonsense" } }));

		expect(res.body.success).toBe(false);
		expect(String(res.body.description)).toMatch(/Invalid playtype 'nonsense'/iu);
	});
});
