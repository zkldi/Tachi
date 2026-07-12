import type http from "http";

import { log } from "#lib/log/log";
import { ClosePgConnection } from "#services/pg/db";
import { CloseRedisConnection } from "#services/redis/redis";

export function HandleSIGTERMGracefully(instance?: http.Server, metricsInstance?: http.Server) {
	log.info({ shutdownInfo: true }, "SIGTERM Received, closing program.");

	if (instance) {
		instance.close(() => {
			if (metricsInstance) {
				metricsInstance.close(() => {
					void CloseEverythingElse();
				});
			} else {
				void CloseEverythingElse();
			}
		});
	} else if (metricsInstance) {
		metricsInstance.close(() => {
			void CloseEverythingElse();
		});
	} else {
		return CloseEverythingElse();
	}
}

async function CloseEverythingElse() {
	log.info({ shutdownInfo: true }, "Closing database...");
	await ClosePgConnection();

	log.info({ shutdownInfo: true }, "Closing Redis Connection.");
	await CloseRedisConnection();

	log.info(
		{
			shutdownInfo: true,
		},
		"Everything closed. Waiting for process to exit naturally.",
	);
}
