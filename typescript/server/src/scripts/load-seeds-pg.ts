/**
 * Imports seed data from a seeds folder into postgres.
 *
 * Required env vars:
 *   POSTGRES_URL
 *
 * Required env vars:
 *   SEEDS_DIR         - path to the db/seeds directory
 *   SEEDS_COMMIT_HASH - git commit SHA to tag the import with (for audit logs)
 *
 * Run with:
 *   just db-load-seeds
 *
 * In `NODE_ENV=dev` only, if no admin account exists yet, this script will make an admin.
 */

import { buildGoalIdRemap, importSeeds, ImportSeedsSubsetForTests } from "../services/pg/seeds";

export { buildGoalIdRemap, importSeeds, ImportSeedsSubsetForTests as importSeedsSubset };

if (require.main === module) {
	const seedsDir = process.env.SEEDS_DIR;
	const commitHash = process.env.SEEDS_COMMIT_HASH;

	if (!seedsDir) {
		console.error("SEEDS_DIR is not set.");
		process.exit(1);
	}

	if (!commitHash) {
		console.error("SEEDS_COMMIT_HASH is not set.");
		process.exit(1);
	}

	// Import inline to avoid loading the full server at module-eval time.
	const { AddNewUser } = await import("#lib/auth/auth");
	const { Env } = await import("#lib/setup/config");
	const { log } = await import("#lib/log/log");
	const DB = (await import("#services/pg/db")).default;
	const { GetUserWithID } = await import("#utils/user");

	if (Env.NODE_ENV === "dev") {
		const anyAdmin = await DB.selectFrom("account")
			.select("id")
			.where("auth_level", "=", "admin")
			.executeTakeFirst();

		if (!anyAdmin) {
			const user1 = await GetUserWithID(1);

			if (!user1) {
				log.info(
					"No admin account exists; creating default local dev admin for seed import.",
				);

				await DB.transaction().execute(async (txn) => {
					const { newUser } = await AddNewUser(
						txn,
						"admin",
						"password",
						"admin@example.com",
					);
					await txn
						.updateTable("account")
						.set({ auth_level: "admin" })
						.where("id", "=", newUser.id)
						.execute();
				});

				log.info(
					"Created admin user (username: admin, password: password, email: admin@example.com).",
				);
			} else {
				log.info(
					"No admin account exists; promoting user #1 to admin for seed import (local dev).",
				);

				await DB.updateTable("account")
					.set({ auth_level: "admin" })
					.where("id", "=", 1)
					.execute();
			}
		}
	}

	const { ACTION_ImportSeeds } = await import("../actions/import-seeds");
	const { DefaultAdminUser } = await import("../lib/jobs/default-admin-user");

	const taker = await DefaultAdminUser.actionTaker();

	await ACTION_ImportSeeds(taker, { commitHash, seedsDir });
}
