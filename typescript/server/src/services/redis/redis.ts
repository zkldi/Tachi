import { log } from "#lib/log/log";
import { Env } from "#lib/setup/config";
import { GetMillisecondsSince } from "#utils/misc";
import Redis from "ioredis";

const startConnect = process.hrtime.bigint();

log.debug({ bootInfo: true }, "Instantiated Redis Client");

export const RedisClient = new Redis(`redis://${Env.REDIS_URL}`, {
	// Don't crash the process on initial connect failure — retry instead.
	lazyConnect: false,
	enableReadyCheck: false,
});

RedisClient.on("connect", () => {
	log.info(
		{ bootInfo: true },
		`Connected to Redis. Took ${GetMillisecondsSince(startConnect)}ms`,
	);
});

export function CloseRedisConnection(): void {
	RedisClient.disconnect();
}
