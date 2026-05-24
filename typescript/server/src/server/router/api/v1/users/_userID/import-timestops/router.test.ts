import { SetImportTimestop } from "#lib/score-import/framework/common/timestop";
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

describe("GET /api/v1/users/:userID/import-timestops", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "timestop_user", withCredential: true, withSettings: true });
		await seedUser({
			username: "other_user",
			email: "other@example.com",
			withCredential: true,
			withSettings: true,
		});

		cookie = await loginAs("timestop_user");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await mockApi.get("/api/v1/users/1/import-timestops");

		expect(res.status).toBe(401);
	});

	it("returns 403 when viewing another user's timestops", async () => {
		const res = await mockApi.get("/api/v1/users/2/import-timestops").set("Cookie", cookie);

		expect(res.status).toBe(403);
	});

	it("returns all API import types for the authenticated user", async () => {
		await SetImportTimestop(1, "api/eag-iidx", new Date("2025-03-15T12:00:00.000Z"));

		const res = await mockApi.get("/api/v1/users/1/import-timestops").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.body.timestops.length).toBeGreaterThan(0);

		const entry = res.body.body.timestops.find(
			(e: { importType: string }) => e.importType === "api/eag-iidx",
		);

		expect(entry.lastScoreTime).toBe(new Date("2025-03-15T12:00:00.000Z").getTime());
	});
});

describe("DELETE /api/v1/users/:userID/import-timestops", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "timestop_user", withCredential: true, withSettings: true });
		await SetImportTimestop(1, "api/eag-iidx", new Date("2025-03-15T12:00:00.000Z"));
		cookie = await loginAs("timestop_user");
	});

	it("resets a timestop", async () => {
		const res = await mockApi
			.delete("/api/v1/users/1/import-timestops")
			.set("Cookie", cookie)
			.send({ importType: "api/eag-iidx" });

		expect(res.status).toBe(200);

		const list = await mockApi.get("/api/v1/users/1/import-timestops").set("Cookie", cookie);
		const entry = list.body.body.timestops.find(
			(e: { importType: string }) => e.importType === "api/eag-iidx",
		);

		expect(entry.lastScoreTime).toBeNull();
	});

	it("rejects invalid import types", async () => {
		const res = await mockApi
			.delete("/api/v1/users/1/import-timestops")
			.set("Cookie", cookie)
			.send({ importType: "file/batch-manual" });

		expect(res.status).toBe(400);
	});
});

describe("PUT /api/v1/users/:userID/import-timestops", () => {
	let cookie: string[];

	beforeEach(async () => {
		await seedUser({ username: "timestop_user", withCredential: true, withSettings: true });
		cookie = await loginAs("timestop_user");
	});

	it("sets a timestop to a specific timestamp", async () => {
		const lastScoreTime = new Date("2024-06-01T08:30:00.000Z").getTime();

		const res = await mockApi
			.put("/api/v1/users/1/import-timestops")
			.set("Cookie", cookie)
			.send({ importType: "api/myt-ongeki", lastScoreTime });

		expect(res.status).toBe(200);

		const list = await mockApi.get("/api/v1/users/1/import-timestops").set("Cookie", cookie);
		const entry = list.body.body.timestops.find(
			(e: { importType: string }) => e.importType === "api/myt-ongeki",
		);

		expect(entry.lastScoreTime).toBe(lastScoreTime);
	});
});
