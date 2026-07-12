import type { NotificationBody, NotificationDocument } from "tachi-common";

import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type Selection } from "kysely";
import { type Database } from "tachi-db";

export const SELECT_NOTIFICATION = [
	"notification.row_id",
	"notification.title",
	"notification.sent_to",
	"notification.sent_at",
	"notification.read",
	"notification.kind",
	"notification.payload",
] as const;

export function ToNotificationDocument(
	row: Selection<Database, "notification", (typeof SELECT_NOTIFICATION)[number]>,
): NotificationDocument {
	const body = row.payload as NotificationBody;

	return {
		title: row.title,
		notifID: row.row_id,
		sentTo: row.sent_to,
		sentAt: ISO8601ToUnixMilliseconds(row.sent_at),
		read: row.read,
		body,
	};
}
