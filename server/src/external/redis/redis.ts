import { ONE_MINUTE, ONE_SECOND } from "lib/constants/time";
import CreateLogCtx from "lib/logger/logger";
import { Environment } from "lib/setup/config";
import redis from "redis";
import { GetMillisecondsSince } from "utils/misc";

const logger = CreateLogCtx(__filename);

logger.verbose("Instantiated Redis Store", { bootInfo: true });

export const RedisClient = redis.createClient({
	url: `redis://${Environment.redisUrl}`,
});

const startConnect = process.hrtime.bigint();

logger.verbose("Instantiated Redis Client", { bootInfo: true });

function EmitCritical() {
	/* istanbul ignore next */
	if (!RedisClient.connected) {
		logger.crit(`Could not connect to redis in time. No more information is available.`);

		// can't connect. kill self after 1 second.
		setTimeout(() => {
			process.exit(1);
		}, ONE_SECOND);
	}
}

// awful performance on windows and in test runners mean that connecting to redis can be a
// nearly FIVE minute endeavour!
const ref = setTimeout(EmitCritical, ONE_MINUTE * 5);

RedisClient.on("connect", () => {
	logger.info(`Connected to Redis. Took ${GetMillisecondsSince(startConnect)}ms`, {
		bootInfo: true,
	});

	clearTimeout(ref);
});

export function CloseRedisConnection() {
	return new Promise((resolve, reject) => {
		RedisClient.quit((err, reply) => {
			if (err) {
				reject(err);
			} else {
				resolve(reply);
			}
		});
	});
}
