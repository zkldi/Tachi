import type { ImportTypes, integer } from "tachi-common";

import DB from "#services/pg/db";
import { sql } from "kysely";

/**
 * Returns the stored last-score-time cursor for a given user + import type,
 * or null if no import has been completed yet.
 */
export async function GetImportTimestop(
	userID: integer,
	importType: ImportTypes,
): Promise<Date | null> {
	const row = await DB.selectFrom("import_timestop")
		.select(["import_timestop.last_score_time"])
		.where("import_timestop.user_id", "=", userID)
		.where("import_timestop.import_type", "=", importType)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return new Date(row.last_score_time);
}

/**
 * Upserts the last-score-time cursor for a given user + import type, always
 * advancing to the greater of the existing value and the new one.
 */
export async function SetImportTimestop(
	userID: integer,
	importType: ImportTypes,
	time: Date,
): Promise<void> {
	const isoTime = time.toISOString();

	await DB.insertInto("import_timestop")
		.values({
			user_id: userID,
			import_type: importType,
			last_score_time: isoTime,
		})
		.onConflict((oc) =>
			oc.columns(["user_id", "import_type"]).doUpdateSet({
				last_score_time: sql<string>`GREATEST(EXCLUDED.last_score_time, import_timestop.last_score_time)`,
			}),
		)
		.execute();
}
