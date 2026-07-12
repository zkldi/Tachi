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

describe("GET /api/v1/users/:userID/integrations/kai/:kaiType", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "kai_int_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("kai_int_user");
	});

	it("returns authStatus false when no token row exists", async () => {
		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/kai/flo`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.authStatus).toBe(false);
	});

	it("returns authStatus true when a token row exists for this user and service", async () => {
		await DB.insertInto("priv_svc_kai_auth_token")
			.values({
				user_id: userId,
				service: "FLO",
				token: "access",
				refresh_token: "refresh",
			})
			.execute();

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/kai/flo`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body.authStatus).toBe(true);
	});

	it("returns authStatus false when another user has FLO auth", async () => {
		const { id: otherId } = await seedUser({
			username: "kai_other",
			email: "kai_other@example.com",
			withCredential: true,
			withSettings: true,
		});

		await DB.insertInto("priv_svc_kai_auth_token")
			.values({
				user_id: otherId,
				service: "FLO",
				token: "t",
				refresh_token: "r",
			})
			.execute();

		const res = await mockApi
			.get(`/api/v1/users/${userId}/integrations/kai/flo`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body.authStatus).toBe(false);
	});
});

describe("DELETE /api/v1/users/:userID/integrations/kai/:kaiType", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "kai_del_user",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("kai_del_user");
	});

	it("returns 409 when not linked", async () => {
		const res = await mockApi
			.delete(`/api/v1/users/${userId}/integrations/kai/eag`)
			.set("Cookie", cookie);

		expect(res.status).toBe(409);
	});

	it("removes the priv_svc_kai_auth_token row", async () => {
		await DB.insertInto("priv_svc_kai_auth_token")
			.values({
				user_id: userId,
				service: "EAG",
				token: "a",
				refresh_token: "b",
			})
			.execute();

		const res = await mockApi
			.delete(`/api/v1/users/${userId}/integrations/kai/eag`)
			.set("Cookie", cookie);

		expect(res.status).toBe(200);

		const row = await DB.selectFrom("priv_svc_kai_auth_token")
			.selectAll()
			.where("user_id", "=", userId)
			.where("service", "=", "EAG")
			.executeTakeFirst();

		expect(row).toBeUndefined();
	});
});
