import type { ActionTaker } from "bliss";

import DB from "#services/pg/db";

/**
 * Lowest-ID Postgres `account` with `auth_level = 'admin'`, used to attribute
 * automated jobs (BMS table sync, etc.) to a real user in action audit logs.
 */
export const DefaultAdminUser = {
	async actionTaker(): Promise<ActionTaker> {
		const row = await DB.selectFrom("account")
			.select(["id", "username"])
			.where("auth_level", "=", "admin")
			.orderBy("id", "asc")
			.executeTakeFirst();

		if (!row) {
			throw new Error(
				"No admin account exists; create one before running jobs that require DefaultAdminUser.",
			);
		}

		return { ip: null, acct: { id: row.id, username: row.username } };
	},
} as const;
