import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

async function seedGameProfile(userId: number) {
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

async function seedQuest(suffix: string) {
	const questId = `q-ugpt-${suffix}`;

	await DB.insertInto("quest")
		.values({
			id: questId,
			game: "iidx-sp",
			name: `Quest ${suffix}`,
			description: "Test quest",
			quest_data: JSON.stringify([]),
		})
		.execute();

	return questId;
}

// ─── GET quests ───────────────────────────────────────────────────────────────

describe("GET /api/v1/users/:userID/games/:game/targets/quests", () => {
	let userId: number;

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		({ id: userId } = await seedUser({ username: `q_get_${suffix}` }));
		await seedGameProfile(userId);
	});

	it("returns 200 with empty arrays when user has no quest subscriptions", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/targets/quests`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.quests).toHaveLength(0);
		expect(res.body.body.questSubs).toHaveLength(0);
		expect(res.body.body.goals).toHaveLength(0);
	});

	it("returns subscribed quests and their goals", async () => {
		const suffix = `${Date.now()}`;
		const questId = await seedQuest(suffix);

		await DB.insertInto("quest_sub")
			.values({
				quest_id: questId,
				user_id: userId,
				achieved: false,
				time_achieved: null,
				progress: 0,
				last_interaction: null,
				was_instantly_achieved: false,
			})
			.execute();

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/targets/quests`);

		expect(res.status).toBe(200);

		const questIds = (res.body.body.quests as Array<{ questID: string }>).map((q) => q.questID);

		expect(questIds).toContain(questId);
	});
});

// ─── GET single quest ─────────────────────────────────────────────────────────

describe("GET /api/v1/users/:userID/games/:game/targets/quests/:questID", () => {
	let userId: number;

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		({ id: userId } = await seedUser({ username: `q_single_${suffix}` }));
		await seedGameProfile(userId);
	});

	it("returns 404 when user is not subscribed", async () => {
		const suffix = `${Date.now()}-ns`;
		const questId = await seedQuest(suffix);

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`,
		);

		expect(res.status).toBe(404);
	});

	it("returns 404 when quest does not exist", async () => {
		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/targets/quests/q_no_such`,
		);

		expect(res.status).toBe(404);
	});

	it("returns quest progress when subscribed", async () => {
		const suffix = `${Date.now()}-sub`;
		const questId = await seedQuest(suffix);

		await DB.insertInto("quest_sub")
			.values({
				quest_id: questId,
				user_id: userId,
				achieved: false,
				time_achieved: null,
				progress: 0,
				last_interaction: null,
				was_instantly_achieved: false,
			})
			.execute();

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`,
		);

		expect(res.status).toBe(200);
		expect(res.body.body.quest.questID).toBe(questId);
		expect(res.body.body.questSub.userID).toBe(userId);
		expect(Array.isArray(res.body.body.goals)).toBe(true);
		expect(Array.isArray(res.body.body.results)).toBe(true);
	});
});

// ─── PUT subscribe ────────────────────────────────────────────────────────────

describe("PUT /api/v1/users/:userID/games/:game/targets/quests/:questID", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		const { username } = await seedUser({
			username: `q_put_${suffix}`,
			withCredential: true,
			withSettings: true,
		});

		const row = await DB.selectFrom("account")
			.select("account.id")
			.where("account.username", "=", username)
			.executeTakeFirstOrThrow();

		userId = Number(row.id);
		cookie = await loginAs(username);
		await seedGameProfile(userId);
	});

	it("returns 401 when not authenticated", async () => {
		const suffix = `${Date.now()}-auth`;
		const questId = await seedQuest(suffix);

		const res = await mockApi.put(
			`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`,
		);

		expect(res.status).toBe(401);
	});

	it("returns 404 when quest does not exist", async () => {
		const res = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/q_no_such`)
			.set("Cookie", cookie);

		expect(res.status).toBe(404);
	});

	it("subscribes the user to the quest and returns 200", async () => {
		const suffix = `${Date.now()}-ok`;
		const questId = await seedQuest(suffix);

		const res = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.quest.questID).toBe(questId);

		const sub = await DB.selectFrom("quest_sub")
			.selectAll()
			.where("quest_sub.quest_id", "=", questId)
			.where("quest_sub.user_id", "=", userId)
			.executeTakeFirst();

		expect(sub).toBeDefined();
	});

	it("returns 409 with 'quest' (not 'goal') when already subscribed", async () => {
		const suffix = `${Date.now()}-dup`;
		const questId = await seedQuest(suffix);

		await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`)
			.set("Cookie", cookie);

		const res = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`)
			.set("Cookie", cookie);

		expect(res.status).toBe(409);
		// The error message must mention "quest", not "goal" (regression guard for the bug fix)
		expect(res.body.description).toMatch(/quest/iu);
		expect(res.body.description).not.toMatch(/goal/iu);
	});
});

// ─── DELETE unsubscribe ───────────────────────────────────────────────────────

describe("DELETE /api/v1/users/:userID/games/:game/targets/quests/:questID", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		const { username } = await seedUser({
			username: `q_del_${suffix}`,
			withCredential: true,
			withSettings: true,
		});

		const row = await DB.selectFrom("account")
			.select("account.id")
			.where("account.username", "=", username)
			.executeTakeFirstOrThrow();

		userId = Number(row.id);
		cookie = await loginAs(username);
		await seedGameProfile(userId);
	});

	it("returns 401 when not authenticated", async () => {
		const suffix = `${Date.now()}-dauth`;
		const questId = await seedQuest(suffix);

		const res = await mockApi.delete(
			`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`,
		);

		expect(res.status).toBe(401);
	});

	it("returns 409 when not subscribed", async () => {
		const suffix = `${Date.now()}-dns`;
		const questId = await seedQuest(suffix);

		const res = await mockApi
			.delete(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`)
			.set("Cookie", cookie);

		expect(res.status).toBe(409);
	});

	it("removes the quest sub and returns 200", async () => {
		const suffix = `${Date.now()}-dok`;
		const questId = await seedQuest(suffix);

		// Subscribe first
		await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`)
			.set("Cookie", cookie);

		const delRes = await mockApi
			.delete(`/api/v1/users/${userId}/games/iidx-sp/targets/quests/${questId}`)
			.set("Cookie", cookie);

		expect(delRes.status).toBe(200);

		const sub = await DB.selectFrom("quest_sub")
			.selectAll()
			.where("quest_sub.quest_id", "=", questId)
			.where("quest_sub.user_id", "=", userId)
			.executeTakeFirst();

		expect(sub).toBeUndefined();
	});
});
