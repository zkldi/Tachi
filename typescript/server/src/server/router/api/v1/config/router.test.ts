import { ServerConfig, TachiConfig } from "#lib/setup/config";
import mockApi from "#test-utils/mock-api";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/config", () => {
	it("returns TachiConfig", async () => {
		const res = await mockApi.get("/api/v1/config");

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.body).toEqual(TachiConfig);
	});
});

describe("GET /api/v1/config/beatoraja-queue-size", () => {
	it("returns BEATORAJA_QUEUE_SIZE", async () => {
		const res = await mockApi.get("/api/v1/config/beatoraja-queue-size");

		expect(res.status).toBe(200);
		expect(res.body.body).toBe(ServerConfig.BEATORAJA_QUEUE_SIZE);
	});
});

describe("GET /api/v1/config/max-rivals", () => {
	it("returns MAX_RIVALS", async () => {
		const res = await mockApi.get("/api/v1/config/max-rivals");

		expect(res.status).toBe(200);
		expect(res.body.body).toBe(ServerConfig.MAX_RIVALS);
	});
});
