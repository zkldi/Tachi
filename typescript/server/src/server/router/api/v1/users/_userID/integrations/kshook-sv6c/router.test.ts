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

async function seedKshookSettings(userId: number, forceStaticImport: boolean) {
	await DB.insertInto("svc_kshook_sv6c_settings")
		.values({ user_id: userId, force_static_import: forceStaticImport })
		.execute();
}

// ─── GET /api/v1/users/:userID/integrations/kshook-sv6c/settings ──────────────

describe("GET /api/v1/users/:userID/integrations/kshook-sv6c/settings", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`);

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns null body when the user has no settings", async () => {
		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toBeNull();
	});

	it("returns the user's settings when present", async () => {
		await seedKshookSettings(userId, true);

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual({ userID: userId, forceStaticImport: true });
	});

	it("does not return another user's settings", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedKshookSettings(other.id, true);

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toBeNull();
	});
});

// ─── PATCH /api/v1/users/:userID/integrations/kshook-sv6c/settings ────────────

describe("PATCH /api/v1/users/:userID/integrations/kshook-sv6c/settings", () => {
	let cookie: string[];
	let userId: number;

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
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when authenticated as a different user", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});
		const otherCookie = await loginAs("other_user");

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", otherCookie)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(403);
		// suppress unused-variable warning
		void other;
	});

	it("creates a settings row and returns 200 on first call", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual({ userID: userId, forceStaticImport: true });
	});

	it("updates an existing settings row", async () => {
		await seedKshookSettings(userId, false);

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(200);
		expect(res.body.body.forceStaticImport).toBe(true);
	});

	it("persists the change to the database", async () => {
		await mockApi
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: true });

		const row = await DB.selectFrom("svc_kshook_sv6c_settings")
			.selectAll()
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.force_static_import).toBe(true);
	});

	it("returns 400 when forceStaticImport is missing", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie)
			.send({});

		expect(res.status).toBe(400);
	});

	it("returns 400 when forceStaticImport is not a boolean", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/kshook-sv6c/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: "yes" });

		expect(res.status).toBe(400);
	});
});
