import type { NextFunction, Request, Response } from "express";
import type { integer } from "tachi-common";

import { ONE_MINUTE } from "#lib/constants/time";
import { log } from "#lib/log/log";
import { Env, ServerConfig } from "#lib/setup/config";

interface RateLimiterEntry {
	count: integer;
	resetAt: number;
}

export interface RateLimitMiddleware {
	(req: Request, res: Response, next: NextFunction): void;
	resetKey(key: string): void;
}

/**
 * Fixed-window in-memory rate limiter. Each unique `req.ip` gets its own counter
 * that resets after `windowMs`. Pass `Infinity` for `max` to create a no-op limiter.
 */
export function createRateLimiter(
	max: integer | typeof Infinity,
	windowMs: number,
): RateLimitMiddleware {
	const store = new Map<string, RateLimiterEntry>();

	function middleware(req: Request, res: Response, next: NextFunction): void {
		if (max === Infinity) {
			next();
			return;
		}

		const key = req.ip ?? "unknown";
		const now = Date.now();

		let entry = store.get(key);

		if (!entry || now >= entry.resetAt) {
			entry = { count: 0, resetAt: now + windowMs };
			store.set(key, entry);
		}

		entry.count++;

		if (entry.count <= max) {
			next();
			return;
		}

		log.warn({ url: req.url, method: req.method }, `User ${key} hit rate limit.`);

		res.status(429).json({
			success: false,
			description: `You have exceeded ${max} requests per ${windowMs / 1000} seconds. Please wait.`,
			status: 429,
			message: "You're being rate limited.",
		});
	}

	middleware.resetKey = (key: string): void => {
		store.delete(key);
	};

	return middleware;
}

if (Env.NODE_ENV === "test") {
	(globalThis as { __tachi_rate_limiter_loaded?: boolean }).__tachi_rate_limiter_loaded = true;
}

/** Express / supertest may use any of these as `req.ip` for loopback. */
const LOOPBACK_RATE_LIMIT_KEYS = ["127.0.0.1", "::ffff:127.0.0.1", "::1"] as const;

export function ClearTestingRateLimitCache() {
	for (const ip of LOOPBACK_RATE_LIMIT_KEYS) {
		NormalRateLimitMiddleware.resetKey(ip);
		AggressiveRateLimitMiddleware.resetKey(ip);
		HyperAggressiveRateLimitMiddleware.resetKey(ip);
	}
}

// 100 requests / minute
export const NormalRateLimitMiddleware = createRateLimiter(ServerConfig.RATE_LIMIT, ONE_MINUTE);

// 15 requests every 10 minutes
export const AggressiveRateLimitMiddleware = createRateLimiter(15, ONE_MINUTE * 10);

// 2 requests every 5 minutes
export const HyperAggressiveRateLimitMiddleware = createRateLimiter(2, ONE_MINUTE * 5);

// 5 requests per minute; unlimited in test or when explicitly disabled for load testing
export const ScoreImportRateLimiter =
	Env.NODE_ENV === "test" || ServerConfig.DISABLE_SCORE_IMPORT_RATE_LIMIT
		? createRateLimiter(Infinity, ONE_MINUTE)
		: createRateLimiter(5, ONE_MINUTE);
