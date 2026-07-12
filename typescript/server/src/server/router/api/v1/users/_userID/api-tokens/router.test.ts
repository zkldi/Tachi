import { getApiToken, seedApiClient, seedApiToken } from "#actions/test-utils/api-tokens";
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

describe("GET /api/v1/users/:userID/api-tokens", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "tok_u1", withCredential: true, withSettings: true });
		await seedUser({ username: "tok_u2" });

		await DB.deleteFrom("priv_api_token").execute();

		await seedApiToken({ token: "tfoo", userId: 1, identifier: "foo" });
		await seedApiToken({ token: "tbar", userId: 1, identifier: "bar" });
		await seedApiToken({ token: "tbaz", userId: 2, identifier: "baz" });

		cookie = await loginAs("tok_u1");
	});

	it("returns only this user's tokens", async () => {
		const res = await mockApi.get("/api/v1/users/1/api-tokens").set("Cookie", cookie);

		expect(res.status).toBe(200);

		const body = res.body.body.sort((a: { identifier: string }, b: { identifier: string }) =>
			a.identifier.localeCompare(b.identifier),
		);

		expect(body).toEqual([
			{
				userID: 1,
				identifier: "bar",
				permissions: {},
				token: "tbar",
				fromAPIClient: null,
			},
			{
				userID: 1,
				identifier: "foo",
				permissions: {},
				token: "tfoo",
				fromAPIClient: null,
			},
		]);
	});

	it("requires authentication as that user", async () => {
		const res = await mockApi.get("/api/v1/users/1/api-tokens");

		expect(res.status).toBe(401);

		const res2 = await mockApi.get("/api/v1/users/2/api-tokens").set("Cookie", cookie);

		expect(res2.status).toBe(403);
	});
});

describe("DELETE /api/v1/users/:userID/api-tokens/:token", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "del_tok_u1", withCredential: true, withSettings: true });
		await seedApiToken({ token: "fake_api_token", userId: 1, identifier: "session" });
		cookie = await loginAs("del_tok_u1");
	});

	it("deletes the token row", async () => {
		const res = await mockApi
			.delete("/api/v1/users/1/api-tokens/fake_api_token")
			.set("Cookie", cookie);

		expect(res.status).toBe(200);

		const row = await getApiToken("fake_api_token");
		expect(row).toBeUndefined();
	});

	it("returns 404 when the token does not exist", async () => {
		const res = await mockApi
			.delete("/api/v1/users/1/api-tokens/non_exist_token")
			.set("Cookie", cookie);

		expect(res.status).toBe(404);
	});

	it("returns 404 when the token belongs to another user (without revealing existence)", async () => {
		await seedUser({ username: "del_tok_u2" });
		await seedApiToken({ token: "foo", userId: 2, identifier: "other" });

		const res = await mockApi.delete("/api/v1/users/1/api-tokens/foo").set("Cookie", cookie);

		expect(res.status).toBe(404);

		const row = await getApiToken("foo");
		expect(row).toBeDefined();
	});

	it("returns 401 without authentication", async () => {
		const res = await mockApi.delete("/api/v1/users/1/api-tokens/foo");

		expect(res.status).toBe(401);
	});
});

describe("POST /api/v1/users/:userID/api-tokens/create", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "crt_tok_u1", withCredential: true, withSettings: true });
		cookie = await loginAs("crt_tok_u1");
	});

	it("creates a token with explicit permission flags", async () => {
		const res = await mockApi
			.post("/api/v1/users/1/api-tokens/create")
			.set("Cookie", cookie)
			.send({
				identifier: "Hello World",
				permissions: ["submit_score", "customise_profile"],
			});

		expect(res.status).toBe(200);

		expect(res.body.body).toMatchObject({
			identifier: "Hello World",
			permissions: { submit_score: true, customise_profile: true },
			userID: 1,
			fromAPIClient: null,
		});

		const row = await DB.selectFrom("priv_api_token")
			.selectAll()
			.where("identifier", "=", "Hello World")
			.executeTakeFirst();

		expect(row).toMatchObject({
			identifier: "Hello World",
			user_id: 1,
			from_oauth2_client: null,
			pm_submit_score: true,
			pm_customise_profile: true,
		});
	});

	it("creates a token from an OAuth2 client id", async () => {
		await seedApiClient({
			clientId: "OAUTH2_CLIENT_ID",
			authorId: 1,
			name: "Test_Service",
			clientSecret: "OAUTH2_CLIENT_SECRET",
			customiseProfile: true,
			redirectUri: "https://example.com/callback",
		});

		const res = await mockApi
			.post("/api/v1/users/1/api-tokens/create")
			.set("Cookie", cookie)
			.send({
				clientID: "OAUTH2_CLIENT_ID",
			});

		expect(res.status).toBe(200);

		expect(res.body.body).toMatchObject({
			identifier: "Test_Service",
			permissions: { customise_profile: true },
			userID: 1,
			fromAPIClient: "OAUTH2_CLIENT_ID",
		});

		const row = await DB.selectFrom("priv_api_token")
			.selectAll()
			.where("identifier", "=", "Test_Service")
			.executeTakeFirst();

		expect(row).toMatchObject({
			identifier: "Test_Service",
			user_id: 1,
			from_oauth2_client: "OAUTH2_CLIENT_ID",
			pm_customise_profile: true,
		});
	});

	it("rejects clientID together with permissions", async () => {
		const res = await mockApi
			.post("/api/v1/users/1/api-tokens/create")
			.set("Cookie", cookie)
			.send({
				identifier: "Hello World",
				permissions: ["submit_score", "customise_profile"],
				clientID: "OAUTH2_CLIENT_ID",
			});

		expect(res.status).toBe(400);
		expect(String(res.body.description)).toMatch(/clientID/iu);
		expect(String(res.body.description)).toMatch(/permissions/iu);
	});

	it("rejects requests with neither clientID nor permissions", async () => {
		const res = await mockApi
			.post("/api/v1/users/1/api-tokens/create")
			.set("Cookie", cookie)
			.send({
				identifier: "Hello World",
			});

		expect(res.status).toBe(400);
		expect(String(res.body.description)).toMatch(/clientID|permissions/iu);
	});

	it("rejects unknown permission keys", async () => {
		const res = await mockApi
			.post("/api/v1/users/1/api-tokens/create")
			.set("Cookie", cookie)
			.send({
				identifier: "Hello World",
				permissions: ["submit_score", "invalid_permission"],
			});

		expect(res.status).toBe(400);
		expect(String(res.body.description)).toMatch(/invalid_permission/iu);
	});
});
