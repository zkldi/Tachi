import { log } from "#lib/log/log";
import { Env } from "#lib/setup/config";
import { GetMillisecondsSince } from "#utils/misc";

const startConnect = process.hrtime.bigint();

log.debug({ bootInfo: true }, "Instantiated Redis Client");

export const RedisClient = new Bun.RedisClient(`redis://${Env.REDIS_URL}`);

RedisClient.onconnect = () => {
	log.info(
		{ bootInfo: true },
		`Connected to Redis. Took ${GetMillisecondsSince(startConnect)}ms`,
	);
};

export function CloseRedisConnection(): void {
	RedisClient.close();
}
