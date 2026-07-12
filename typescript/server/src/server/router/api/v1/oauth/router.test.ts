import { seedApiClient } from "#actions/test-utils/api-tokens";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

async function loginAs(username: string, password = "password123") {
	const res = await mockApi.post("/api/v1/auth/login").send({
		username,
		"!password": password,
		captcha: "test",
	});

	return res.headers["set-cookie"] as unknown as string[];
}

afterAll(() => CloseServerConnection());

describe("POST /api/v1/oauth/token", () => {
	let userId: number;
	const clientId = "OAUTH2_CLIENT_ID";
	const clientSecret = "OAUTH2_CLIENT_SECRET";
	const redirectUri = "https://example.com/callback";
	const authCode = "AUTH_CODE";

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "oauth_user",
			withCredential: true,
			withSettings: true,
		}));

		await seedApiClient({
			clientId,
			authorId: userId,
			name: "Test_Service",
			clientSecret,
			customiseProfile: true,
			redirectUri,
		});

		await DB.insertInto("priv_oauth2_auth_token")
			.values({
				token: authCode,
				user_id: userId,
				created_on: new Date().toISOString(),
			})
			.execute();
	});

	it("grants an api token and consumes the auth code", async () => {
		const res = await mockApi.post(`/api/v1/oauth/token`).send({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
			code: authCode,
		});

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.userID).toBe(userId);
		expect(res.body.body.fromAPIClient).toBe(clientId);
		expect(res.body.body.permissions).toEqual({
			customise_profile: true,
		});

		const tokenRow = await DB.selectFrom("priv_api_token")
			.selectAll()
			.where("token", "=", res.body.body.token)
			.executeTakeFirst();

		expect(tokenRow).toBeDefined();
		expect(tokenRow?.user_id).toBe(userId);
		expect(tokenRow?.from_oauth2_client).toBe(clientId);

		const codeRow = await DB.selectFrom("priv_oauth2_auth_token")
			.selectAll()
			.where("token", "=", authCode)
			.executeTakeFirst();

		expect(codeRow).toBeUndefined();
	});

	it("returns 404 for invalid code", async () => {
		const res = await mockApi.post(`/api/v1/oauth/token`).send({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
			code: "invalidcode",
		});

		expect(res.status).toBe(404);
	});

	it("returns 404 for invalid client id", async () => {
		const res = await mockApi.post(`/api/v1/oauth/token`).send({
			client_id: "INVALID_CLIENT_ID",
			client_secret: clientSecret,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
			code: authCode,
		});

		expect(res.status).toBe(404);
	});

	it("returns 403 for invalid client secret", async () => {
		const res = await mockApi.post(`/api/v1/oauth/token`).send({
			client_id: clientId,
			client_secret: "INVALID_SECRET",
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
			code: authCode,
		});

		expect(res.status).toBe(403);
	});

	it("returns 400 for redirect_uri mismatch", async () => {
		const res = await mockApi.post(`/api/v1/oauth/token`).send({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "authorization_code",
			redirect_uri: "https://invalid.example.com/callback",
			code: authCode,
		});

		expect(res.status).toBe(400);
	});
});

describe("POST /api/v1/oauth/create-code", () => {
	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.post("/api/v1/oauth/create-code");

		expect(res.status).toBe(401);
	});

	it("creates a row in priv_oauth2_auth_token", async () => {
		const { id: uid } = await seedUser({
			username: "oauth_code_user",
			withCredential: true,
			withSettings: true,
		});
		const cookie = await loginAs("oauth_code_user");

		const res = await mockApi.post("/api/v1/oauth/create-code").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.code).toBeTruthy();
		expect(typeof res.body.body.createdOn).toBe("number");
		expect(res.body.body.userID).toBe(uid);

		const row = await DB.selectFrom("priv_oauth2_auth_token")
			.selectAll()
			.where("token", "=", res.body.body.code)
			.executeTakeFirst();

		expect(row).toBeDefined();
		expect(Number(row?.user_id)).toBe(uid);
	});
});
