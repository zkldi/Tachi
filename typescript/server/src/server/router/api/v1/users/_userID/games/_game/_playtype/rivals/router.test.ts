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

async function seedUgpt(userId: number) {
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

describe("GET /api/v1/users/:userID/games/:game/rivals", () => {
	beforeEach(async () => {
		await seedUser({ username: "rival_main", withCredential: true, withSettings: true });
		await seedUser({
			username: "rival_b",
			email: "rb@test.com",
			withCredential: true,
			withSettings: true,
		});
		await seedUser({
			username: "rival_c",
			email: "rc@test.com",
			withCredential: true,
			withSettings: true,
		});

		await seedUgpt(1);
		await seedUgpt(2);
		await seedUgpt(3);

		await DB.insertInto("game_rival")
			.values([
				{ user_id: 1, game: "iidx-sp", rival: 2 },
				{ user_id: 1, game: "iidx-sp", rival: 3 },
			])
			.execute();
	});

	it("returns rival user documents in order", async () => {
		const res = await mockApi.get("/api/v1/users/1/games/iidx-sp/rivals");

		expect(res.status).toBe(200);
		expect(res.body.body.map((u: { id: number }) => u.id)).toEqual([2, 3]);
	});

	it.skip("returns 500 when a rival account row is missing", () => {
		// Mongo tests could leave `game_rival.rival` pointing at a deleted user. Postgres
		// enforces `game_rival.rival REFERENCES account(id)`, so that state cannot exist.
	});
});

describe("GET /api/v1/users/:userID/games/:game/rivals/activity", () => {
	beforeEach(async () => {
		await seedUser({ username: "rival_act_main", withCredential: true, withSettings: true });
		await seedUser({
			username: "rival_act_b",
			email: "ractb@test.com",
			withCredential: true,
			withSettings: true,
		});
		await seedUser({
			username: "rival_act_c",
			email: "ractc@test.com",
			withCredential: true,
			withSettings: true,
		});

		await seedUgpt(1);
		await seedUgpt(2);
		await seedUgpt(3);

		await DB.insertInto("game_rival")
			.values([
				{ user_id: 1, game: "iidx-sp", rival: 2 },
				{ user_id: 1, game: "iidx-sp", rival: 3 },
			])
			.execute();
	});

	it("returns 200 with an activity payload", async () => {
		const res = await mockApi.get("/api/v1/users/1/games/iidx-sp/rivals/activity");

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toMatchObject({
			achievedClasses: [],
			charts: [],
			goals: [],
			goalSubs: [],
			quests: [],
			questSubs: [],
			recentSessions: [],
			recentlyHighlightedScores: [],
			songs: [],
			users: [],
		});
	});
});

describe("PUT /api/v1/users/:userID/games/:game/rivals", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "rput_main", withCredential: true, withSettings: true });
		await seedUser({
			username: "rput_b",
			email: "rputb@test.com",
			withCredential: true,
			withSettings: true,
		});
		await seedUser({
			username: "rput_c",
			email: "rputc@test.com",
			withCredential: true,
			withSettings: true,
		});
		await seedUgpt(1);
		await seedUgpt(2);
		await seedUgpt(3);
		await DB.insertInto("game_rival")
			.values([
				{ user_id: 1, game: "iidx-sp", rival: 2 },
				{ user_id: 1, game: "iidx-sp", rival: 3 },
			])
			.execute();

		cookie = await loginAs("rput_main");
	});

	it("replaces rival IDs", async () => {
		const res = await mockApi
			.put("/api/v1/users/1/games/iidx-sp/rivals")
			.set("Cookie", cookie)
			.send({ rivalIDs: [2] });

		expect(res.status).toBe(200);

		const rows = await DB.selectFrom("game_rival")
			.select("rival")
			.where("user_id", "=", 1)
			.where("game", "=", "iidx-sp")
			.execute();

		expect(rows.map((r) => r.rival)).toEqual([2]);
	});

	it("returns 400 when rivaling yourself", async () => {
		const res = await mockApi
			.put("/api/v1/users/1/games/iidx-sp/rivals")
			.set("Cookie", cookie)
			.send({ rivalIDs: [1] });

		expect(res.status).toBe(400);
	});

	it("returns 401 without auth", async () => {
		const res = await mockApi
			.put("/api/v1/users/1/games/iidx-sp/rivals")
			.send({ rivalIDs: [2] });

		expect(res.status).toBe(401);
	});
});

describe("GET /api/v1/users/:userID/games/:game/rivals/challengers", () => {
	it.todo("port full challengers matrix from router.oldtest.ts");
});
