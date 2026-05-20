import express from "express";
import supertest from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./rate-limiter";

function makeApp(max: number, windowMs: number) {
	const limiter = createRateLimiter(max, windowMs);
	const app = express();

	app.set("trust proxy", true);
	app.use(limiter);
	app.get("/", (_req, res) => res.status(200).json({ ok: true }));

	return { app, limiter };
}

describe("createRateLimiter", () => {
	describe("under the limit", () => {
		it("allows requests below max", async () => {
			const { app } = makeApp(3, 60_000);

			for (let i = 0; i < 3; i++) {
				const res = await supertest(app).get("/");
				expect(res.status).toBe(200);
			}
		});
	});

	describe("over the limit", () => {
		it("returns 429 once max is exceeded", async () => {
			const { app } = makeApp(2, 60_000);

			await supertest(app).get("/");
			await supertest(app).get("/");

			const res = await supertest(app).get("/");
			expect(res.status).toBe(429);
			expect(res.body.success).toBe(false);
			expect(res.body.status).toBe(429);
		});

		it("includes the window duration in the description", async () => {
			const { app } = makeApp(1, 30_000);

			await supertest(app).get("/");
			const res = await supertest(app).get("/");

			expect(res.body.description).toContain("30 seconds");
		});
	});

	describe("window reset", () => {
		it("resets the counter after the window expires", async () => {
			vi.useFakeTimers();

			const { app } = makeApp(1, 1_000);

			await supertest(app).get("/");
			expect((await supertest(app).get("/")).status).toBe(429);

			// Advance past the window
			vi.advanceTimersByTime(1_001);

			expect((await supertest(app).get("/")).status).toBe(200);

			vi.useRealTimers();
		});
	});

	describe("key isolation", () => {
		it("tracks different IPs independently", async () => {
			const { app } = makeApp(1, 60_000);

			// First IP exhausts its quota
			await supertest(app).get("/").set("X-Forwarded-For", "1.2.3.4");
			expect((await supertest(app).get("/").set("X-Forwarded-For", "1.2.3.4")).status).toBe(
				429,
			);

			// Second IP still has quota
			expect((await supertest(app).get("/").set("X-Forwarded-For", "5.6.7.8")).status).toBe(
				200,
			);
		});
	});

	describe("resetKey", () => {
		it("clears the counter for a key so requests are allowed again", async () => {
			const { app, limiter } = makeApp(1, 60_000);

			await supertest(app).get("/");
			expect((await supertest(app).get("/")).status).toBe(429);

			limiter.resetKey("::ffff:127.0.0.1");

			expect((await supertest(app).get("/")).status).toBe(200);
		});
	});

	describe("Infinity max", () => {
		it("always allows requests through", async () => {
			const { app } = makeApp(Infinity, 1);

			for (let i = 0; i < 100; i++) {
				expect((await supertest(app).get("/")).status).toBe(200);
			}
		});
	});

	describe("exact boundary", () => {
		it("allows the max-th request and blocks the (max+1)-th", async () => {
			const max = 5;
			const { app } = makeApp(max, 60_000);

			for (let i = 0; i < max; i++) {
				expect((await supertest(app).get("/")).status).toBe(200);
			}

			expect((await supertest(app).get("/")).status).toBe(429);
		});
	});
});
