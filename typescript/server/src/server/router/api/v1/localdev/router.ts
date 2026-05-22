import { withLocalDev } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import DB from "#services/pg/db";
import { GetFirstAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

import { API_V1_ROUTER } from "../_singleton";

/**
 * Reports whether the database has any rows in the `song` table (seed data).
 */
API_V1_ROUTER.add("GET /localdev/song-seed-status", withLocalDev, async () => {
	const row = await DB.selectFrom("song")
		.select((eb) => eb.fn.countAll().as("count"))
		.executeTakeFirst();

	const songCount = Number(row?.count ?? 0);

	return success("Song seed status retrieved.", { missingSongSeeds: songCount === 0 });
});

/**
 * Username of the lowest-ID admin (same as {@link GetFirstAdmin}) and the dev default
 * password for the quick-login button on the login page.
 */
API_V1_ROUTER.add("GET /localdev/first-admin-login", withLocalDev, async () => {
	try {
		const admin = await GetFirstAdmin();

		return success("First admin login hint retrieved.", {
			password: "password",
			username: admin.username,
		});
	} catch {
		throw new ExpectedErr(404, "No admin account exists on this instance.");
	}
});
