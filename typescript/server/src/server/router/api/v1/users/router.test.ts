import DB from "#services/pg/db";
import mockApi from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { type UserDocument } from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

async function insertUserWithLastSeen(username: string, lastSeenMs: number) {
	const ts = new Date(lastSeenMs).toISOString();

	await DB.insertInto("account")
		.values({
			username,
			about: "",
			joined: ts,
			last_seen: ts,
			auth_level: "user",
			custom_pfp_location: null,
			custom_banner_location: null,
		})
		.execute();
}

// ─── GET /api/v1/users ───────────────────────────────────────────────────────

describe("GET /api/v1/users", () => {
	beforeEach(async () => {
		await seedUser();
	});

	it("returns 200 with an array of users", async () => {
		const res = await mockApi.get("/api/v1/users");

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.body)).toBe(true);
	});

	it("returns users sorted by last_seen descending", async () => {
		await insertUserWithLastSeen("older_user", Date.now() - 10_000);

		const res = await mockApi.get("/api/v1/users");

		expect(res.status).toBe(200);
		const usernames = res.body.body.map((u: UserDocument) => u.username);
		expect(usernames[0]).toBe("test_user");
		expect(usernames[1]).toBe("older_user");
	});

	it("caps results at 100 users", async () => {
		await Promise.all(
			Array.from({ length: 105 }, (_, i) =>
				insertUserWithLastSeen(`bulk_user_${i}`, Date.now()),
			),
		);

		const res = await mockApi.get("/api/v1/users");

		expect(res.status).toBe(200);
		expect(res.body.body.length).toBeLessThanOrEqual(100);
	});
});

// ─── GET /api/v1/users?search= ───────────────────────────────────────────────

describe("GET /api/v1/users?search=", () => {
	beforeEach(async () => {
		await seedUser({ username: "test_zkldi" });
	});

	it("returns users whose username contains the search string", async () => {
		const res = await mockApi.get("/api/v1/users?search=zkldi");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].username).toBe("test_zkldi");
	});

	it("returns no results when nothing matches", async () => {
		const res = await mockApi.get("/api/v1/users?search=nobody");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(0);
	});

	it("is case-insensitive", async () => {
		const res = await mockApi.get("/api/v1/users?search=ZklDI");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].username).toBe("test_zkldi");
	});

	it("treats regex special characters as literals", async () => {
		// '.*' matches everything as a regex, but is treated as a literal ILIKE
		// pattern - no usernames contain that substring, so results are empty.
		const res = await mockApi.get("/api/v1/users?search=.*");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(0);
	});

	it("returns 400 when search is provided as an array", async () => {
		// Supertest forwards ?search=foo&search=bar as an array in req.query.
		const res = await mockApi.get("/api/v1/users?search=foo&search=bar");

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});
});

// ─── GET /api/v1/users?online ────────────────────────────────────────────────

describe("GET /api/v1/users?online", () => {
	const TEN_MINUTES_AGO = Date.now() - 10 * 60 * 1000;

	it("returns no users when none have been recently active", async () => {
		await insertUserWithLastSeen("offline_user", TEN_MINUTES_AGO);

		const res = await mockApi.get("/api/v1/users?online");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(0);
	});

	it("returns users who have been recently active", async () => {
		await seedUser({ username: "online_user" });

		const res = await mockApi.get("/api/v1/users?online");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].username).toBe("online_user");
	});

	it("excludes offline users when some are online", async () => {
		await seedUser({ username: "online_user" });
		await insertUserWithLastSeen("offline_user", TEN_MINUTES_AGO);

		const res = await mockApi.get("/api/v1/users?online");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].username).toBe("online_user");
	});

	it("online users are sorted by last_seen descending", async () => {
		await seedUser({ username: "user_a" });
		// Give user_b a slightly older last_seen so the order is deterministic.
		await insertUserWithLastSeen("user_b", Date.now() - 1_000);

		const res = await mockApi.get("/api/v1/users?online");

		expect(res.status).toBe(200);
		const usernames = res.body.body.map((u: UserDocument) => u.username);
		expect(usernames[0]).toBe("user_a");
		expect(usernames[1]).toBe("user_b");
	});
});

// ─── GET /api/v1/users?search=&online ────────────────────────────────────────

describe("GET /api/v1/users?search=&online", () => {
	const TEN_MINUTES_AGO = Date.now() - 10 * 60 * 1000;

	beforeEach(async () => {
		await seedUser({ username: "active_user" });
		await insertUserWithLastSeen("inactive_user", TEN_MINUTES_AGO);
	});

	it("returns online users matching the search term", async () => {
		const res = await mockApi.get("/api/v1/users?search=active&online");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(1);
		expect(res.body.body[0].username).toBe("active_user");
	});

	it("excludes offline users even when the search term would match them", async () => {
		const res = await mockApi.get("/api/v1/users?search=inactive&online");

		expect(res.status).toBe(200);
		expect(res.body.body).toHaveLength(0);
	});
});
