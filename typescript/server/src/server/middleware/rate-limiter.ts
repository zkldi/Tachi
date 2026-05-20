import type { Request } from "express";
import type { integer } from "tachi-common";

import { ONE_MINUTE } from "#lib/constants/time";
import { log } from "#lib/log/log";
import { Env, ServerConfig, TachiConfig } from "#lib/setup/config";
import { RedisClient } from "#services/redis/redis";
import { OmitUndefinedKeys } from "#utils/misc";
import rateLimit, { type Options } from "express-rate-limit";
import RateLimitRedis from "rate-limit-redis";

if (process.env.NODE_ENV === "test") {
	// Signal to vitest.setup.ts that this worker has loaded the rate limiter,
	// so its beforeEach should clear the in-memory cache. Pure-unit test files
	// that never load any router skip the cache-clear (and the import chain)
	// entirely.
	(globalThis as { __tachi_rate_limiter_loaded?: boolean }).__tachi_rate_limiter_loaded = true;
}

function CreateStore(name: string) {
	// undefined forces a default to an in-memory store
	// So we use that when in testing or localdev.
	return Env.NODE_ENV === "production" || Env.NODE_ENV === "staging"
		? new RateLimitRedis({ prefix: `${TachiConfig.NAME}-RL:${name}`, client: RedisClient })
		: undefined;
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

const CreateRateLimitOptions = (max: integer, name: string, windowMs?: number): Partial<Options> =>
	OmitUndefinedKeys({
		max,
		onLimitReached: (req: Request) => {
			log.warn(
				{
					url: req.url,
					method: req.method,
					hideFromConsole: ["req"],
				},
				`User ${req.ip} hit rate limit.`,
			);
		},
		store: CreateStore(name),
		message: {
			success: false,
			description: `You have exceeded ${max} requests per ${
				(windowMs ?? 60_000) / 1000
			} seconds. Please wait.`,
			status: 429,
			message: "You're being rate limited.",
		},
		windowMs,
	});

// 100 requests / minute is the current cap
export const NormalRateLimitMiddleware = rateLimit(
	CreateRateLimitOptions(ServerConfig.RATE_LIMIT, "Normal"),
);

// 15 requests every 10 minutes.
export const AggressiveRateLimitMiddleware = rateLimit(
	CreateRateLimitOptions(15, "Aggressive", ONE_MINUTE * 10),
);

// 2 requests every 5 minutes.
export const HyperAggressiveRateLimitMiddleware = rateLimit(
	CreateRateLimitOptions(2, "HyAgressive", ONE_MINUTE * 5),
);

// 5 requests every minute. This one has a tighter window, so it is less
// vulnerable to bursting down the server.
// Vitest: unlimited. Optional: TACHI_DISABLE_SCORE_IMPORT_RATE_LIMIT for local stress runs.
export const ScoreImportRateLimiter =
	Env.NODE_ENV === "test" || ServerConfig.DISABLE_SCORE_IMPORT_RATE_LIMIT
		? rateLimit(CreateRateLimitOptions(Infinity, "ScImport", ONE_MINUTE))
		: rateLimit(CreateRateLimitOptions(5, "ScImport", ONE_MINUTE));
