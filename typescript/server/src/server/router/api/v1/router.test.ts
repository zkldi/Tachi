import { ClearTestingRateLimitCache } from "#server/middleware/rate-limiter";
import mockApi from "#test-utils/mock-api";
import { describe, expect, it } from "vitest";

describe("/ir rate limiting", () => {
	it("returns 429 after enough sequential requests (normal limit)", async () => {
		ClearTestingRateLimitCache();

		let rateLimited = 0;
		for (let i = 0; i < 520; i++) {
			// NormalRateLimitMiddleware is mounted on `/ir`, not `/api/v1`.
			// Run sequentially so the in-memory counter updates deterministically.
			const res = await mockApi.get("/ir/__rate_limit_probe__");
			if (res.status === 429) {
				rateLimited++;
			}
		}

		expect(rateLimited).toBeGreaterThan(0);
	});
});

describe("404 handler", () => {
	it("returns a stable JSON body for unknown routes", async () => {
		ClearTestingRateLimitCache();

		const res = await mockApi.get("/api/v1/invalid_route_that_will_never_exist");

		expect(res.status).toBe(404);
		expect(res.body).toEqual({
			success: false,
			description: "Endpoint Not Found.",
		});
	});
});
