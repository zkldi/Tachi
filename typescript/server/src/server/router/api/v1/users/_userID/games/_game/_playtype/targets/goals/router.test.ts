import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedMinimalIidxSpChart, seedUser } from "#test-utils/pg-fixtures";
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

// ─── GET goals ────────────────────────────────────────────────────────────────

describe("GET /api/v1/users/:userID/games/:game/targets/goals", () => {
	let userId: number;

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		({ id: userId } = await seedUser({
			username: `goals_get_${suffix}`,
			withCredential: true,
			withSettings: true,
		}));
		await seedGameProfile(userId);
	});

	it("returns 200 with empty arrays when user has no goals", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/targets/goals`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.goals).toHaveLength(0);
		expect(res.body.body.goalSubs).toHaveLength(0);
	});

	it("returns the user's subscribed goals when they have some", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const goalId = `G_get_${Date.now()}`;

		await DB.insertInto("goal")
			.values({
				id: goalId,
				game: "iidx-sp",
				name: "Listed goal",
				charts: JSON.stringify({ type: "single", data: chartId }),
				criteria: JSON.stringify({ mode: "single", key: "lamp", value: 7 }),
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: goalId,
				user_id: userId,
				achieved: false,
				time_achieved: null,
				progress: null,
				progress_human: "NO DATA",
				out_of: 7,
				out_of_human: "FULL COMBO",
				last_interaction: null,
				was_instantly_achieved: false,
				was_assigned_standalone: true,
			})
			.execute();

		const res = await mockApi.get(`/api/v1/users/${userId}/games/iidx-sp/targets/goals`);

		expect(res.status).toBe(200);
		expect(res.body.body.goalSubs.length).toBeGreaterThanOrEqual(1);
	});
});

// ─── POST add-goal ────────────────────────────────────────────────────────────

describe("POST /api/v1/users/:userID/games/:game/targets/goals/add-goal", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		const { username } = await seedUser({
			username: `goals_add_${suffix}`,
			withCredential: true,
			withSettings: true,
		});

		// seedUser returns the inserted id but we need to look it up since id is serial
		const row = await DB.selectFrom("account")
			.select("account.id")
			.where("account.username", "=", username)
			.executeTakeFirstOrThrow();

		userId = Number(row.id);
		cookie = await loginAs(username);
		await seedGameProfile(userId);
	});

	it("returns 401 when not authenticated", async () => {
		const chartId = await seedMinimalIidxSpChart();

		const res = await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.send({
				charts: { type: "single", data: chartId },
				criteria: { mode: "single", key: "lamp", value: 7 },
			});

		expect(res.status).toBe(401);
	});

	it("returns 200 and creates the goal + sub when input is valid", async () => {
		const chartId = await seedMinimalIidxSpChart();

		const res = await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartId },
				criteria: { mode: "single", key: "lamp", value: 7 },
			});

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.goal.game).toBe("iidx-sp");
		expect(res.body.body.goalSub.userID).toBe(userId);
	});

	it("returns 409 when the user is already subscribed to that goal", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const body = {
			charts: { type: "single", data: chartId },
			criteria: { mode: "single", key: "lamp", value: 7 },
		};

		await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.set("Cookie", cookie)
			.send(body);

		const res = await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.set("Cookie", cookie)
			.send(body);

		expect(res.status).toBe(409);
		expect(res.body.success).toBe(false);
	});
});

// ─── GET single goal ──────────────────────────────────────────────────────────

describe("GET /api/v1/users/:userID/games/:game/targets/goals/:goalID", () => {
	let userId: number;

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		({ id: userId } = await seedUser({ username: `goals_single_${suffix}` }));
		await seedGameProfile(userId);
	});

	it("returns 404 when user is not subscribed to the goal", async () => {
		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/targets/goals/G_no_such`,
		);

		expect(res.status).toBe(404);
	});

	it("returns the goal sub when subscribed", async () => {
		const chartId = await seedMinimalIidxSpChart();
		const goalId = `G_single_${Date.now()}`;

		await DB.insertInto("goal")
			.values({
				id: goalId,
				game: "iidx-sp",
				name: "Single test goal",
				charts: JSON.stringify({ type: "single", data: chartId }),
				criteria: JSON.stringify({ mode: "single", key: "lamp", value: 4 }),
			})
			.execute();

		await DB.insertInto("goal_sub")
			.values({
				goal_id: goalId,
				user_id: userId,
				achieved: false,
				time_achieved: null,
				progress: null,
				progress_human: "NO DATA",
				out_of: 4,
				out_of_human: "HARD CLEAR",
				last_interaction: null,
				was_instantly_achieved: false,
				was_assigned_standalone: true,
			})
			.execute();

		const res = await mockApi.get(
			`/api/v1/users/${userId}/games/iidx-sp/targets/goals/${goalId}`,
		);

		expect(res.status).toBe(200);
		expect(res.body.body.goal.goalID).toBe(goalId);
		expect(res.body.body.goalSub.userID).toBe(userId);
	});
});

// ─── PUT update goal ──────────────────────────────────────────────────────────

describe("PUT /api/v1/users/:userID/games/:game/targets/goals/:goalID", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		const { username } = await seedUser({
			username: `goals_put_${suffix}`,
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
		const res = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/G_fake`)
			.send({
				charts: { type: "single", data: "C_fake" },
				criteria: { mode: "single", key: "lamp", value: 7 },
			});

		expect(res.status).toBe(401);
	});

	it("returns 404 when not subscribed to the old goal", async () => {
		const chartId = await seedMinimalIidxSpChart();

		const res = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/G_nonexistent`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartId },
				criteria: { mode: "single", key: "lamp", value: 7 },
			});

		expect(res.status).toBe(404);
	});

	it("swaps the goal subscription and returns the new goal", async () => {
		const chartA = await seedMinimalIidxSpChart();
		const chartB = await seedMinimalIidxSpChart();

		// Add initial goal via the add-goal endpoint
		const addRes = await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartA },
				criteria: { mode: "single", key: "lamp", value: 4 },
			});

		expect(addRes.status).toBe(200);

		const oldGoalID = addRes.body.body.goal.goalID as string;

		// Update to a different chart
		const putRes = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/${oldGoalID}`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartB },
				criteria: { mode: "single", key: "lamp", value: 4 },
			});

		expect(putRes.status).toBe(200);
		expect(putRes.body.success).toBe(true);
		expect(putRes.body.body.changed).toBe(true);
		expect(putRes.body.body.goal.charts).toMatchObject({ type: "single", data: chartB });
		expect(putRes.body.body.goalSub.userID).toBe(userId);

		// Old sub should be gone
		const oldSub = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_sub.goal_id", "=", oldGoalID)
			.where("goal_sub.user_id", "=", userId)
			.executeTakeFirst();

		expect(oldSub).toBeUndefined();
	});

	it("returns changed: false when the definition is unchanged", async () => {
		const chartId = await seedMinimalIidxSpChart();

		const addRes = await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartId },
				criteria: { mode: "single", key: "lamp", value: 4 },
			});

		const goalID = addRes.body.body.goal.goalID as string;

		const putRes = await mockApi
			.put(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/${goalID}`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartId },
				criteria: { mode: "single", key: "lamp", value: 4 },
			});

		expect(putRes.status).toBe(200);
		expect(putRes.body.body.changed).toBe(false);
		expect(putRes.body.body.goal.goalID).toBe(goalID);
	});
});

// ─── DELETE goal ──────────────────────────────────────────────────────────────

describe("DELETE /api/v1/users/:userID/games/:game/targets/goals/:goalID", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		const suffix = Math.random().toString(36).slice(2, 10);
		const { username } = await seedUser({
			username: `goals_del_${suffix}`,
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
		const res = await mockApi.delete(
			`/api/v1/users/${userId}/games/iidx-sp/targets/goals/G_fake`,
		);

		expect(res.status).toBe(401);
	});

	it("removes the goal sub and returns 200", async () => {
		const chartId = await seedMinimalIidxSpChart();

		const addRes = await mockApi
			.post(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/add-goal`)
			.set("Cookie", cookie)
			.send({
				charts: { type: "single", data: chartId },
				criteria: { mode: "single", key: "lamp", value: 4 },
			});

		const goalID = addRes.body.body.goal.goalID as string;

		const delRes = await mockApi
			.delete(`/api/v1/users/${userId}/games/iidx-sp/targets/goals/${goalID}`)
			.set("Cookie", cookie);

		expect(delRes.status).toBe(200);

		const sub = await DB.selectFrom("goal_sub")
			.selectAll()
			.where("goal_sub.goal_id", "=", goalID)
			.where("goal_sub.user_id", "=", userId)
			.executeTakeFirst();

		expect(sub).toBeUndefined();
	});
});
