import type { integer, NotificationBody } from "tachi-common";

import DB from "#services/pg/db";

function notificationBodyToRow(title: string, toUserID: integer, body: NotificationBody) {
	return {
		title,
		sent_to: toUserID,
		read: false,
		sent_at: new Date().toISOString(),
		kind: body.type.toLowerCase(),
		payload: { type: body.type, content: body.content } as unknown,
	};
}

/**
 * Send a notification to a user.
 *
 * @param title - A human friendly title for this notification.
 * @param toUserID - The user to send the notification to.
 * @param body - The body of the notification.
 */
export async function SendNotification(
	title: string,
	toUserID: integer,
	body: NotificationBody,
): Promise<void> {
	await DB.insertInto("notification")
		.values(notificationBodyToRow(title, toUserID, body))
		.execute();
}

/**
 * Send notifications to multiple users at once. This is more efficient than calling
 * send notification in parallel.
 */
export async function BulkSendNotification(
	title: string,
	toUserIDs: Array<integer>,
	body: NotificationBody,
): Promise<void> {
	if (toUserIDs.length === 0) {
		return;
	}

	const rows = toUserIDs.map((id) => notificationBodyToRow(title, id, body));

	await DB.insertInto("notification").values(rows).execute();
}
