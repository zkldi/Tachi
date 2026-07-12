import type { InviteCodeDocument } from "tachi-common";

import { seedApiToken } from "#actions/test-utils/api-tokens";
import { ONE_MONTH } from "#lib/constants/time";
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

describe("GET /api/v1/users/:userID/invites", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "inv_u1", withCredential: true, withSettings: true });

		await seedUser({ username: "other_dude" });

		await DB.insertInto("priv_invite")
			.values([
				{
					code: "example_invite",
					created_by: 1,
					created_at: "1970-01-01T00:00:00.000Z",
					consumed: false,
					consumed_by: null,
					consumed_at: null,
				},
				{
					code: "example_consumed_invite",
					created_by: 1,
					created_at: "1970-01-01T00:00:00.001Z",
					consumed: true,
					consumed_by: 2,
					consumed_at: "1970-01-01T00:00:00.123Z",
				},
			])
			.execute();

		cookie = await loginAs("inv_u1");
	});

	it("returns this user's created invites and who used them", async () => {
		const res = await mockApi.get("/api/v1/users/1/invites").set("Cookie", cookie);

		expect(res.status).toBe(200);

		const invites = (res.body.body.invites as Array<InviteCodeDocument>).sort(
			(a, b) => a.createdAt - b.createdAt,
		);

		expect(invites).toEqual([
			{
				code: "example_invite",
				createdBy: 1,
				createdAt: 0,
				consumed: false,
				consumedBy: null,
				consumedAt: null,
			},
			{
				code: "example_consumed_invite",
				createdBy: 1,
				createdAt: 1,
				consumed: true,
				consumedBy: 2,
				consumedAt: 123,
			},
		]);

		expect(res.body.body.consumers).toHaveLength(1);
		expect(res.body.body.consumers[0]).toMatchObject({
			id: 2,
			username: "other_dude",
			usernameLowercase: "other_dude",
		});
	});

	it("requires self-key authentication", async () => {
		const res = await mockApi.get("/api/v1/users/1/invites");

		expect(res.status).toBe(401);

		await seedApiToken({ token: "inv_sess_only", userId: 1, identifier: "sess" });

		const res2 = await mockApi
			.get("/api/v1/users/1/invites")
			.set("Authorization", "Bearer inv_sess_only");

		expect(res2.status).toBe(403);
	});
});

describe("GET /api/v1/users/:userID/invites/limit", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "lim_u1", withCredential: true, withSettings: true });

		await DB.insertInto("priv_invite")
			.values([
				{
					code: "a",
					created_by: 1,
					created_at: new Date().toISOString(),
					consumed: false,
					consumed_by: null,
					consumed_at: null,
				},
				{
					code: "b",
					created_by: 1,
					created_at: new Date().toISOString(),
					consumed: false,
					consumed_by: null,
					consumed_at: null,
				},
			])
			.execute();

		await DB.updateTable("account")
			.set({ joined: new Date(Date.now() - ONE_MONTH * 2.5).toISOString() })
			.where("account.id", "=", 1)
			.execute();

		cookie = await loginAs("lim_u1");
	});

	it("returns invite usage vs limit for this user", async () => {
		const res = await mockApi.get("/api/v1/users/1/invites/limit").set("Cookie", cookie);

		expect(res.body.body.invites).toBe(2);
		expect(res.body.body.limit).toBe(4);
	});

	it("requires self-key authentication", async () => {
		const res = await mockApi.get("/api/v1/users/1/invites/limit");

		expect(res.status).toBe(401);

		await seedApiToken({ token: "lim_sess_only", userId: 1, identifier: "sess" });

		const res2 = await mockApi
			.get("/api/v1/users/1/invites/limit")
			.set("Authorization", "Bearer lim_sess_only");

		expect(res2.status).toBe(403);
	});
});

describe("POST /api/v1/users/:userID/invites/create", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "crt_u1", withCredential: true, withSettings: true });

		await DB.updateTable("account")
			.set({ joined: new Date(Date.now() - ONE_MONTH * 2.5).toISOString() })
			.where("account.id", "=", 1)
			.execute();

		cookie = await loginAs("crt_u1");
	});

	it("creates a new invite", async () => {
		const res = await mockApi.post("/api/v1/users/1/invites/create").set("Cookie", cookie);

		expect(res.status).toBe(200);

		const dbRes = await DB.selectFrom("priv_invite")
			.selectAll()
			.where("code", "=", res.body.body.code)
			.executeTakeFirst();

		expect(dbRes).not.toBeNull();
	});

	it("honours the invite limit for new accounts", async () => {
		await DB.deleteFrom("priv_invite").execute();

		await DB.updateTable("account")
			.set({ joined: new Date().toISOString(), auth_level: "user" })
			.where("account.id", "=", 1)
			.execute();

		const res = await mockApi.post("/api/v1/users/1/invites/create").set("Cookie", cookie);

		expect(res.status).toBe(400);
	});

	it("requires self-key authentication", async () => {
		const res = await mockApi.post("/api/v1/users/1/invites/create");

		expect(res.status).toBe(401);

		await seedApiToken({ token: "crt_sess_only", userId: 1, identifier: "sess" });

		const res2 = await mockApi
			.post("/api/v1/users/1/invites/create")
			.set("Authorization", "Bearer crt_sess_only");

		expect(res2.status).toBe(403);
	});
});
