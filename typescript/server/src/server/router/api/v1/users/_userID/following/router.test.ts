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

async function seedFollowing(userId: number, followeeId: number) {
	await DB.insertInto("account_following")
		.values({ user_id: userId, followee: followeeId })
		.execute();
}

// ─── GET /api/v1/users/:userID/following ─────────────────────────────────────

describe("GET /api/v1/users/:userID/following", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
	});

	it("returns 200 with empty friends list when user follows nobody", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/following`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.friends).toEqual([]);
	});

	it("returns the users this user is following", async () => {
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });
		await seedFollowing(userId, otherId);

		const res = await mockApi.get(`/api/v1/users/${userId}/following`);

		expect(res.status).toBe(200);
		expect(res.body.body.friends).toHaveLength(1);
		expect(res.body.body.friends[0].username).toBe("other_user");
	});
});

// ─── POST /api/v1/users/:userID/following/add ────────────────────────────────

describe("POST /api/v1/users/:userID/following/add", () => {
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
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/add`)
			.send({ userID: otherId });

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when trying to follow on behalf of a different user", async () => {
		const { id: otherId } = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});
		const otherCookie = await loginAs("other_user");

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/add`)
			.set("Cookie", otherCookie)
			.send({ userID: otherId });

		expect(res.status).toBe(403);
	});

	it("returns 400 when trying to follow yourself", async () => {
		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/add`)
			.set("Cookie", cookie)
			.send({ userID: userId });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 409 when already following the user", async () => {
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });
		await seedFollowing(userId, otherId);

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/add`)
			.set("Cookie", cookie)
			.send({ userID: otherId });

		expect(res.status).toBe(409);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 when the target user does not exist", async () => {
		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/add`)
			.set("Cookie", cookie)
			.send({ userID: 99999 });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("follows the user and inserts an account_following row", async () => {
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/add`)
			.set("Cookie", cookie)
			.send({ userID: otherId });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.description).toContain("other_user");

		const row = await DB.selectFrom("account_following")
			.selectAll()
			.where("user_id", "=", userId)
			.where("followee", "=", otherId)
			.executeTakeFirst();

		expect(row).toBeDefined();
	});
});

// ─── POST /api/v1/users/:userID/following/remove ─────────────────────────────

describe("POST /api/v1/users/:userID/following/remove", () => {
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
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/remove`)
			.send({ userID: otherId });

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 409 when not following the user", async () => {
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/remove`)
			.set("Cookie", cookie)
			.send({ userID: otherId });

		expect(res.status).toBe(409);
		expect(res.body.success).toBe(false);
	});

	it("unfollows the user and removes the account_following row", async () => {
		const { id: otherId } = await seedUser({ username: "other_user", withSettings: true });
		await seedFollowing(userId, otherId);

		const res = await mockApi
			.post(`/api/v1/users/${userId}/following/remove`)
			.set("Cookie", cookie)
			.send({ userID: otherId });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.description).toContain("other_user");

		const row = await DB.selectFrom("account_following")
			.selectAll()
			.where("user_id", "=", userId)
			.where("followee", "=", otherId)
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});
});
