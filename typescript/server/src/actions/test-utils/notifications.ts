import { ONE_SECOND } from "#lib/constants/time";
import { SELECT_NOTIFICATION } from "#lib/db-formats/notification";
import DB from "#services/pg/db";

export interface SeedNotifOpts {
	userId: number;
	title?: string;
	read?: boolean;
	/** Age of the notification in milliseconds. Defaults to 10 seconds (older than cutoff). */
	ageMs?: number;
}

export async function seedNotification(opts: SeedNotifOpts) {
	const ageMs = opts.ageMs ?? ONE_SECOND * 10;
	const sentAt = new Date(Date.now() - ageMs).toISOString();

	const row = await DB.insertInto("notification")
		.values({
			title: opts.title ?? "Test Notification",
			sent_to: opts.userId,
			sent_at: sentAt,
			read: opts.read ?? false,
			kind: "site_announcement",
			payload: {},
		})
		.returning("row_id")
		.executeTakeFirstOrThrow();

	return row.row_id;
}

export function getNotification(rowId: string) {
	return DB.selectFrom("notification")
		.select(SELECT_NOTIFICATION)
		.where("notification.row_id", "=", rowId)
		.executeTakeFirst();
}

export async function countNotificationsForUser(userId: number) {
	const rows = await DB.selectFrom("notification")
		.select("row_id")
		.where("sent_to", "=", userId)
		.execute();

	return rows.length;
}
