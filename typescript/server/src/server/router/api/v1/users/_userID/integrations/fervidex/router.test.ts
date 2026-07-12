import { ClearTestingRateLimitCache } from "#server/middleware/rate-limiter";
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

async function seedFerSettings(userId: number, forceStaticImport: boolean) {
	await DB.insertInto("svc_fer_settings")
		.values({ user_id: userId, force_static_import: forceStaticImport })
		.execute();
}

async function seedFerCards(userId: number, cards: Array<string>) {
	if (cards.length === 0) {
		return;
	}
	await DB.insertInto("priv_svc_fer_card")
		.values(cards.map((card_id) => ({ user_id: userId, card_id })))
		.execute();
}

// ─── GET /api/v1/users/:userID/integrations/fervidex/settings ─────────────────

describe("GET /api/v1/users/:userID/integrations/fervidex/settings", () => {
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
		const res = await mockApi.get(`/api/v1/users/${userId}/integrations/fervidex/settings`);

		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when accessing another user's settings", async () => {
		const other = await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seedFerSettings(other.id, false);

		const res = await mockApi
			.get(`/api/v1/users/${other.id}/integrations/fervidex/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("returns default settings when the user has no row", async () => {
		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual({
			userID: userId,
			cards: null,
			forceStaticImport: false,
		});
	});

	it("returns the settings document when the user has a row but no cards", async () => {
		await seedFerSettings(userId, true);

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual({
			userID: userId,
			cards: null,
			forceStaticImport: true,
		});
	});

	it("returns cards in the response when card filters are configured", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["CARD_A", "CARD_B"]);

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toMatchObject({
			userID: userId,
			forceStaticImport: false,
		});
		expect(res.body.body.cards).toEqual(expect.arrayContaining(["CARD_A", "CARD_B"]));
	});

	it("does not return another user's settings", async () => {
		const other = await seedUser({ username: "other_user", email: "other@example.com" });
		await seedFerSettings(other.id, true);
		await seedFerCards(other.id, ["OTHER_CARD"]);

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body).toEqual({
			userID: userId,
			cards: null,
			forceStaticImport: false,
		});
	});
});

// ─── PATCH /api/v1/users/:userID/integrations/fervidex/settings ───────────────

describe("PATCH /api/v1/users/:userID/integrations/fervidex/settings", () => {
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
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
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
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", otherCookie)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(403);
		void other;
	});

	it("returns 400 when no modifications are sent", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({});

		expect(res.status).toBe(400);
		expect(res.body.description).toMatch(/No modifications sent/u);
	});

	it("returns 400 when forceStaticImport is the only field but is null", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: null });

		expect(res.status).toBe(400);
		expect(res.body.description).toMatch(/No modifications sent/u);
	});

	it("returns 400 when more than 6 card filters are provided", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ cards: ["A", "B", "C", "D", "E", "F", "G"] });

		expect(res.status).toBe(400);
		expect(res.body.description).toMatch(/6 card filters/u);
	});

	it("creates a settings row and returns 200 on the first call", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toMatchObject({ userID: userId, forceStaticImport: true });
	});

	it("updates forceStaticImport on an existing settings row", async () => {
		await seedFerSettings(userId, false);

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: true });

		expect(res.status).toBe(200);
		expect(res.body.body.forceStaticImport).toBe(true);
	});

	it("sets card filters when cards are provided", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ cards: ["CARD_1", "CARD_2"] });

		expect(res.status).toBe(200);
		expect(res.body.body.cards).toEqual(expect.arrayContaining(["CARD_1", "CARD_2"]));
	});

	it("replaces existing card filters", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["OLD_CARD"]);

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ cards: ["NEW_CARD"] });

		expect(res.status).toBe(200);
		expect(res.body.body.cards).toEqual(["NEW_CARD"]);
	});

	it("clears card filters when cards is null", async () => {
		await seedFerSettings(userId, false);
		await seedFerCards(userId, ["CARD_A"]);

		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ cards: null });

		expect(res.status).toBe(200);
		expect(res.body.body.cards).toBeNull();
	});

	it("persists forceStaticImport change to the database", async () => {
		await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ forceStaticImport: true });

		const row = await DB.selectFrom("svc_fer_settings")
			.selectAll()
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(row.force_static_import).toBe(true);
	});

	it("persists card filter changes to the database", async () => {
		await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ cards: ["PERSISTED"] });

		const rows = await DB.selectFrom("priv_svc_fer_card")
			.select(["priv_svc_fer_card.card_id"])
			.where("user_id", "=", userId)
			.execute();

		expect(rows.map((r) => r.card_id)).toEqual(["PERSISTED"]);
	});

	it("accepts exactly 6 card filters (boundary)", async () => {
		const res = await mockApi
			.patch(`/api/v1/users/${userId}/integrations/fervidex/settings`)
			.set("Cookie", cookie)
			.send({ cards: ["A", "B", "C", "D", "E", "F"] });

		expect(res.status).toBe(200);
	});
});
