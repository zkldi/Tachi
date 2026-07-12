import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
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

async function seedIIDXUserProfile(userId: number) {
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

describe("GET /api/v1/users/:userID/games/:game/showcase", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: `showcase_get_${Math.random().toString(36).slice(2, 10)}`,
			withCredential: true,
		}));
		await seedIIDXUserProfile(userId);
	});

	it("returns 200 with an empty evaluated list when showcase has no stats", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/showcase`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual([]);
	});
});

describe("PUT /api/v1/users/:userID/games/:game/showcase", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		const username = `showcase_put_${Math.random().toString(36).slice(2, 10)}`;
		({ id: userId } = await seedUser({
			username,
			withCredential: true,
			withSettings: true,
		}));
		await seedIIDXUserProfile(userId);
		cookie = await loginAs(username);
	});

	it("persists showcase stats and returns merged settings", async () => {
		const chartId = `showcase_chart_${Math.random().toString(36).slice(2, 10)}`;

		await DB.insertInto("song")
			.values({
				id: chartId,
				legacy_id: 77_000 + Math.floor(Math.random() * 1000),
				game_group: "iidx",
				title: "Showcase Put",
				artist: "Test",
				search_terms: [],
				alt_titles: [],
				data: JSON.stringify({ displayVersion: "1", genre: "T" }),
				fts_document: "",
			})
			.execute();

		await DB.insertInto("chart")
			.values({
				id: chartId,
				legacy_id: chartId,
				game: "iidx-sp",
				song_id: chartId,
				level: "10",
				level_num: 10,
				is_primary: true,
				difficulty: "ANOTHER",
				versions: ["27"],
				data: JSON.stringify({ inGameID: 1, notecount: 100 }),
			})
			.execute();

		const stats = [{ mode: "chart" as const, chartID: chartId }];

		const res = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/showcase`)
			.set("Cookie", cookie)
			.send({ showcase: stats });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.preferences.stats).toEqual(stats);

		const row = await DB.selectFrom("game_profile")
			.select("game_profile.showcase")
			.where("game_profile.user_id", "=", userId)
			.where("game_profile.game", "=", "iidx-sp")
			.executeTakeFirst();

		expect(row).toBeDefined();
		expect(row?.showcase).toEqual(stats);
	});
});
