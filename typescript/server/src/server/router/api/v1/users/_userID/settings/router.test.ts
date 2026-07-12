import { seedApiToken } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

async function getSettings(userId: number) {
	return DB.selectFrom("account_settings")
		.selectAll()
		.where("user_id", "=", userId)
		.executeTakeFirst();
}

// ─── GET /api/v1/users/:userID/settings ──────────────────────────────────────

describe("GET /api/v1/users/:userID/settings", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
	});

	it("returns 200 with the user's settings", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/settings`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toMatchObject({
			userID: userId,
			preferences: {
				invisible: false,
				developerMode: false,
				advancedMode: false,
				contentiousContent: false,
				deletableScores: false,
			},
		});
	});

	it("returns 404 when the user does not exist", async () => {
		const res = await mockApi.get("/api/v1/users/99999/settings");

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});
});

// ─── PATCH /api/v1/users/:userID/settings ────────────────────────────────────

describe("PATCH /api/v1/users/:userID/settings", () => {
	let userId: number;
	let cookie: string[];

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.send({ invisible: true });

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when using an API key instead of a session cookie", async () => {
		await seedApiToken({ token: "test_token", userId });

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Authorization", "Bearer test_token")
			.send({ invisible: true });

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);

		const row = await getSettings(userId);
		expect(row?.pf_invisible).toBe(false);
	});

	it("returns 403 when trying to modify another user's settings", async () => {
		const { id: otherId } = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});
		const otherCookie = await loginAs("other_user");

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Cookie", otherCookie)
			.send({ invisible: true });

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);

		const row = await getSettings(otherId);
		expect(row?.pf_invisible).toBe(false);
	});

	it("returns 400 when body is empty", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Cookie", cookie)
			.send({});

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 when a boolean field has the wrong type", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Cookie", cookie)
			.send({ developerMode: "true" });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("updates only the specified preferences and leaves others unchanged", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Cookie", cookie)
			.send({ invisible: true, developerMode: true });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.preferences).toMatchObject({
			invisible: true,
			developerMode: true,
			advancedMode: false,
			contentiousContent: false,
			deletableScores: false,
		});

		const row = await getSettings(userId);
		expect(row?.pf_invisible).toBe(true);
		expect(row?.pf_developer_mode).toBe(true);
		expect(row?.pf_advanced_mode).toBe(false);
	});

	it("returns the updated settings document in body", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Cookie", cookie)
			.send({ advancedMode: true });

		expect(res.status).toBe(200);
		expect(res.body.body).toMatchObject({
			userID: userId,
			preferences: { advancedMode: true },
		});
	});

	it("writes a GOOD action row on success", async () => {
		await mockApi
			.patch(`/api/v1/users/${userId}/settings`)
			.set("Cookie", cookie)
			.send({ invisible: true });

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "UPDATE_USER_SETTINGS")
			.executeTakeFirst();

		expect(action).toBeDefined();
		expect(action).toMatchObject({ result: "GOOD", user_id: userId });
	});
});
