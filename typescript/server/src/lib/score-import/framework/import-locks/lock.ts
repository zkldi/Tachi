import type { integer } from "tachi-common";

import { ONE_DAY, ONE_HOUR } from "#lib/constants/time";
import { SELECT_IMPORT_LOCK } from "#lib/db-formats/import-lock";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";

/**
 * If a user has no ongoing import, enable the import lock and return false (lock acquired).
 * If a user has an ongoing import, return true (caller should reject with 409).
 *
 * @returns True if the user **already had** an active lock (cannot import). False if lock was acquired.
 */
export function CheckAndSetOngoingImportLock(userID: integer): Promise<boolean> {
	return DB.transaction().execute(async (trx) => {
		await trx
			.insertInto("import_lock")
			.values({
				user_id: userID,
				locked: false,
				locked_at: null,
			})
			.onConflict((oc) => oc.column("user_id").doNothing())
			.execute();

		let row = await trx
			.selectFrom("import_lock")
			.select(SELECT_IMPORT_LOCK)
			.where("import_lock.user_id", "=", userID)
			.forUpdate()
			.executeTakeFirstOrThrow();

		if (row.locked && row.locked_at) {
			const lockedAtMs = Date.parse(row.locked_at);

			if (lockedAtMs + ONE_DAY < Date.now()) {
				log.warn(
					`Removed import lock for ${userID} as it is ostensibly stuck (>${ONE_DAY}ms).`,
				);
				await trx
					.updateTable("import_lock")
					.set({ locked: false, locked_at: null })
					.where("user_id", "=", userID)
					.execute();
			} else if (Date.now() - lockedAtMs > ONE_HOUR) {
				log.error(
					`User ${userID} has been locked for an hour. Automatically freeing the lock as they're stuck.`,
				);
				await trx
					.updateTable("import_lock")
					.set({ locked: false, locked_at: null })
					.where("user_id", "=", userID)
					.execute();
			}

			row = await trx
				.selectFrom("import_lock")
				.select(SELECT_IMPORT_LOCK)
				.where("import_lock.user_id", "=", userID)
				.forUpdate()
				.executeTakeFirstOrThrow();
		}

		if (row.locked) {
			return true;
		}

		const now = new Date().toISOString();

		await trx
			.updateTable("import_lock")
			.set({ locked: true, locked_at: now })
			.where("user_id", "=", userID)
			.where("locked", "=", false)
			.execute();

		return false;
	});
}

/**
 * Disable a user's import lock.
 */
export async function UnsetOngoingImportLock(userID: integer): Promise<void> {
	await DB.updateTable("import_lock")
		.set({ locked: false, locked_at: null })
		.where("user_id", "=", userID)
		.where("locked", "=", true)
		.execute();
}
