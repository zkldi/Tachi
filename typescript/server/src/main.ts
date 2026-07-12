import type http from "http";

import { AddNewUser } from "#lib/auth/auth";
import { LoadDefaultClients } from "#lib/builtin-clients/builtin-clients";
import { VERSION_PRETTY } from "#lib/constants/version";
import { HandleSIGTERMGracefully } from "#lib/handlers/sigterm";
import { log } from "#lib/log/log";
import { Env, ServerConfig, TachiConfig } from "#lib/setup/config";
import { METRICS_PORT } from "#server/prometheus";
import server, { metricsApp } from "#server/server";
import DB from "#services/pg/db";
import fetch from "#utils/fetch";
import { GetUserWithID } from "#utils/user";
import { applyMigrations } from "tachi-db-migration-engine";

log.info(
	{
		bootInfo: true,
	},
	`Booting ${TachiConfig.NAME} - ${VERSION_PRETTY} [ENV: ${Env.NODE_ENV}]`,
);
log.info({ bootInfo: true }, `Log level is set to ${Env.LOG_LEVEL}.`);

log.info({ bootInfo: true }, `Loading sequence documents...`);

async function RunOnInit() {
	await applyMigrations(Env.POSTGRES_URL, Env.MIGRATIONS_DIR);

	if (Env.NODE_ENV === "dev") {
		const exists = await GetUserWithID(1);

		if (!exists) {
			log.info("First time setup in LOCAL DEV: Creating an admin user for you.");

			await DB.transaction().execute(async (txn) => {
				await AddNewUser(txn, "admin", "password", "admin@example.com");

				await txn
					.updateTable("account")
					.set({ auth_level: "admin" })
					.where("id", "=", 1)
					.execute();
			});

			log.info("Done! You have an admin user with password 'password'");
		}
	}

	await LoadDefaultClients();

	try {
		await fetch("https://example.com");
	} catch (err) {
		if (ServerConfig.ALLOW_RUNNING_OFFLINE === true) {
			log.warn(
				`This instance of tachi-server cannot access the internet, however, ALLOW_RUNNING_OFFLINE was set. Allowing it anyway, but some things will not work.`,
			);
		} else {
			log.fatal(
				{ err },
				`Cannot send HTTPS request to https://example.com. This instance of tachi-server cannot access the internet?`,
			);
		}
	}
}

void RunOnInit();

const instance: http.Server = server.listen(Env.PORT);
log.info({ bootInfo: true }, `HTTP Listening on port ${Env.PORT}`);

let metricsInstance: http.Server | undefined;
if (metricsApp) {
	metricsInstance = metricsApp.listen(METRICS_PORT);
	log.info(
		{ bootInfo: true },
		`Prometheus metrics listening on port ${METRICS_PORT} (/metrics).`,
	);
}

process.on("SIGTERM", () => {
	void HandleSIGTERMGracefully(instance, metricsInstance);
});
