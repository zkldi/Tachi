import { seedApiToken } from "#actions/test-utils/api-tokens";
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

describe("GET /api/v1/users/:userID/notifications", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "notif_u1", withCredential: true, withSettings: true });
		await seedUser({ username: "notif_u2" });

		await DB.insertInto("notification")
			.values({
				title: "u",
				sent_to: 1,
				sent_at: new Date(3000).toISOString(),
				read: false,
				kind: "site_announcement",
				payload: {},
			})
			.execute();

		await DB.insertInto("notification")
			.values({
				title: "r",
				sent_to: 1,
				sent_at: new Date(2000).toISOString(),
				read: true,
				kind: "site_announcement",
				payload: {},
			})
			.execute();

		await DB.insertInto("notification")
			.values({
				title: "o",
				sent_to: 2,
				sent_at: new Date(4000).toISOString(),
				read: false,
				kind: "site_announcement",
				payload: {},
			})
			.execute();

		cookie = await loginAs("notif_u1");
	});

	it("returns this user's notifications (most recent first)", async () => {
		const res = await mockApi.get("/api/v1/users/1/notifications").set("Cookie", cookie);

		expect(res.status).toBe(200);
		const ids = res.body.body.map((e: { notifID: string }) => e.notifID);
		const rows = await DB.selectFrom("notification")
			.select(["notification.row_id"])
			.where("notification.sent_to", "=", 1)
			.orderBy("notification.sent_at", "desc")
			.execute();
		expect(ids).toEqual(rows.map((r) => r.row_id));
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.get("/api/v1/users/1/notifications");

		expect(res.status).toBe(401);
	});

	it("returns 403 when authenticated as another user", async () => {
		const res = await mockApi.get("/api/v1/users/2/notifications").set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("returns 403 when using an API key instead of a session cookie", async () => {
		await seedApiToken({ token: "no_cookie", userId: 1, identifier: "x" });

		const res = await mockApi
			.get("/api/v1/users/1/notifications")
			.set("Authorization", "Bearer no_cookie");

		expect(res.status).toBe(403);
	});
});

describe("POST /api/v1/users/:userID/notifications/mark-all-read", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "mar_u1", withCredential: true, withSettings: true });
		await seedUser({ username: "mar_u2" });

		await DB.insertInto("notification")
			.values([
				{
					title: "a",
					sent_to: 1,
					sent_at: new Date(2000).toISOString(),
					read: true,
					kind: "site_announcement",
					payload: {},
				},
				{
					title: "b",
					sent_to: 1,
					sent_at: new Date(3000).toISOString(),
					read: false,
					kind: "site_announcement",
					payload: {},
				},
				{
					title: "c",
					sent_to: 1,
					sent_at: new Date(4000).toISOString(),
					read: false,
					kind: "site_announcement",
					payload: {},
				},
				{
					title: "d",
					sent_to: 2,
					sent_at: new Date(5000).toISOString(),
					read: false,
					kind: "site_announcement",
					payload: {},
				},
			])
			.execute();

		cookie = await loginAs("mar_u1");
	});

	it("marks all of the user's notifications as read", async () => {
		const res = await mockApi
			.post("/api/v1/users/1/notifications/mark-all-read")
			.set("Cookie", cookie);

		expect(res.status).toBe(200);

		const unread = await DB.selectFrom("notification")
			.selectAll()
			.where("notification.sent_to", "=", 1)
			.where("notification.read", "=", false)
			.executeTakeFirst();

		expect(unread).toBeUndefined();
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.post("/api/v1/users/1/notifications/mark-all-read");

		expect(res.status).toBe(401);
	});

	it("returns 403 when authenticated as another user", async () => {
		const res = await mockApi
			.post("/api/v1/users/2/notifications/mark-all-read")
			.set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("returns 403 when using an API key instead of a session cookie", async () => {
		await seedApiToken({ token: "mar_tok", userId: 1, identifier: "x" });

		const res = await mockApi
			.post("/api/v1/users/1/notifications/mark-all-read")
			.set("Authorization", "Bearer mar_tok");

		expect(res.status).toBe(403);
	});
});

describe("POST /api/v1/users/:userID/notifications/delete-all", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "deln_u1", withCredential: true, withSettings: true });
		await seedUser({ username: "deln_u2" });

		await DB.insertInto("notification")
			.values([
				{
					title: "a",
					sent_to: 1,
					sent_at: new Date(2000).toISOString(),
					read: true,
					kind: "site_announcement",
					payload: {},
				},
				{
					title: "b",
					sent_to: 1,
					sent_at: new Date(3000).toISOString(),
					read: false,
					kind: "site_announcement",
					payload: {},
				},
				{
					title: "c",
					sent_to: 2,
					sent_at: new Date(4000).toISOString(),
					read: false,
					kind: "site_announcement",
					payload: {},
				},
			])
			.execute();

		cookie = await loginAs("deln_u1");
	});

	it("empties the user's notification inbox", async () => {
		const res = await mockApi
			.post("/api/v1/users/1/notifications/delete-all")
			.set("Cookie", cookie);

		expect(res.status).toBe(200);

		const left = await DB.selectFrom("notification")
			.selectAll()
			.where("notification.sent_to", "=", 1)
			.executeTakeFirst();

		expect(left).toBeUndefined();

		const other = await DB.selectFrom("notification")
			.selectAll()
			.where("notification.sent_to", "=", 2)
			.executeTakeFirst();

		expect(other).toBeDefined();
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.post("/api/v1/users/1/notifications/delete-all");

		expect(res.status).toBe(401);
	});

	it("returns 403 when authenticated as another user", async () => {
		const res = await mockApi
			.post("/api/v1/users/2/notifications/delete-all")
			.set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("returns 403 when using an API key instead of a session cookie", async () => {
		await seedApiToken({ token: "deln_tok", userId: 1, identifier: "x" });

		const res = await mockApi
			.post("/api/v1/users/1/notifications/delete-all")
			.set("Authorization", "Bearer deln_tok");

		expect(res.status).toBe(403);
	});
});
