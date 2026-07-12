import { ClearTestingRateLimitCache } from "#server/middleware/rate-limiter";
import DB from "#services/pg/db";
import mockApi from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

const CARD = "ABCDEFGHIJKLMNOP";
const PIN = "1234";

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

describe("GET /api/v1/users/:userID/integrations/cg/:cgType", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		ClearTestingRateLimitCache();
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.get(`/api/v1/users/${userId}/integrations/cg/dev`);

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when accessing another user's integration", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});

		const res = await mockApi
			.get(`/api/v1/users/${other.id}/integrations/cg/dev`)
			.set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("returns 404 for an unsupported cgType", async () => {
		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/cg/unknown`)
			.set("Cookie", cookie);

		expect(res.status).toBe(404);
	});

	it("returns null body when the user has no card info", async () => {
		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/cg/dev`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toBeNull();
		expect(res.body.description).toContain("no card info");
	});

	it("returns card info when present", async () => {
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "dev", card_id: CARD, pin: PIN })
			.execute();

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/cg/dev`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual({
			userID: userId,
			service: "dev",
			cardID: CARD,
			pin: PIN,
		});
	});
});

describe("PUT /api/v1/users/:userID/integrations/cg/:cgType", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		ClearTestingRateLimitCache();
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.put(`/api/v1/users/${userId}/integrations/cg/dev`).send({
			cardID: CARD,
			pin: PIN,
		});

		expect(res.status).toBe(401);
	});

	it("returns 403 when updating another user's integration", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});

		const res = await mockApi
			.put(`/api/v1/users/${other.id}/integrations/cg/dev`)
			.set("Cookie", cookie)
			.send({ cardID: CARD, pin: PIN });

		expect(res.status).toBe(403);
	});

	it("returns 200 and persists card info", async () => {
		const res = await mockApi
			.put(`/api/v1/users/${userId}/integrations/cg/gan`)
			.set("Cookie", cookie)
			.send({ cardID: CARD, pin: PIN });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const row = await DB.selectFrom("priv_svc_cg_card_info")
			.selectAll()
			.where("user_id", "=", userId)
			.where("service", "=", "gan")
			.executeTakeFirstOrThrow();

		expect(row.card_id).toBe(CARD);
		expect(row.pin).toBe(PIN);
	});
});

describe("DELETE /api/v1/users/:userID/integrations/cg/:cgType", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		ClearTestingRateLimitCache();
		({ id: userId } = await seedUser({
			username: "test_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("test_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.delete(`/api/v1/users/${userId}/integrations/cg/dev`);

		expect(res.status).toBe(401);
	});

	it("returns 200 and removes the row when present", async () => {
		await DB.insertInto("priv_svc_cg_card_info")
			.values({ user_id: userId, service: "nag", card_id: CARD, pin: PIN })
			.execute();

		const res = await mockApi
			.delete(`/api/v1/users/${userId}/integrations/cg/nag`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const row = await DB.selectFrom("priv_svc_cg_card_info")
			.selectAll()
			.where("user_id", "=", userId)
			.where("service", "=", "nag")
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});
});
