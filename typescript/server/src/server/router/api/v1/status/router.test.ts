import { VERSION_PRETTY } from "#lib/constants/version";
import { ClearTestingRateLimitCache } from "#server/middleware/rate-limiter";
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

describe("GET /api/v1/status", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		ClearTestingRateLimitCache();
		({ id: userId } = await seedUser({
			username: "status_tester",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("status_tester");
	});

	it("returns server time, version, and authenticated user", async () => {
		const res = await mockApi.get("/api/v1/status").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Math.abs(Date.now() - res.body.body.serverTime)).toBeLessThan(5000);
		expect(typeof res.body.body.startTime).toBe("number");
		expect(res.body.body.version).toBe(VERSION_PRETTY);
		expect(res.body.body.whoami).toBe(userId);
		expect(Array.isArray(res.body.body.permissions)).toBe(true);
	});

	it("echoes the query echo param when provided", async () => {
		const res = await mockApi.get("/api/v1/status?echo=foobar").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.echo).toBe("foobar");
		expect(res.body.body.version).toBe(VERSION_PRETTY);
		expect(res.body.body.whoami).toBe(userId);
	});
});

describe("POST /api/v1/status", () => {
	let cookie: string[];
	let userId: number;

	beforeEach(async () => {
		ClearTestingRateLimitCache();
		({ id: userId } = await seedUser({
			username: "status_post_tester",
			withCredential: true,
			withSettings: true,
		}));
		cookie = await loginAs("status_post_tester");
	});

	it("returns server time, version, and authenticated user", async () => {
		const res = await mockApi.post("/api/v1/status").set("Cookie", cookie);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Math.abs(Date.now() - res.body.body.serverTime)).toBeLessThan(5000);
		expect(res.body.body.version).toBe(VERSION_PRETTY);
		expect(res.body.body.whoami).toBe(userId);
		expect(typeof res.body.body.startTime).toBe("number");
	});

	it("echoes echo in the JSON body when provided", async () => {
		const res = await mockApi
			.post("/api/v1/status")
			.set("Cookie", cookie)
			.send({ echo: "foobar" });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body.echo).toBe("foobar");
		expect(res.body.body.version).toBe(VERSION_PRETTY);
		expect(res.body.body.whoami).toBe(userId);
	});
});
