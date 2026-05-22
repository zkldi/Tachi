import { ACTION_DeleteAllNotifications } from "#actions/delete-all-notifications";
import { ACTION_MarkAllNotificationsRead } from "#actions/mark-all-notifications-read";
import { SELECT_NOTIFICATION, ToNotificationDocument } from "#lib/db-formats/notification";
import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";

/**
 * Return all of this user's notifications, this is sorted on most recently sent first.
 *
 * @name GET /api/v1/users/:userID/notifications
 */
API_V1_ROUTER.add(
	"GET /users/:userID/notifications",
	withRequestedUser,
	withSelf,
	async ({ ctx }) => {
		const rows = await DB.selectFrom("notification")
			.select(SELECT_NOTIFICATION)
			.where("notification.sent_to", "=", ctx.requestedUser.id)
			.orderBy("notification.sent_at", "desc")
			.execute();

		const notifs = rows.map(ToNotificationDocument);

		return success(`Found ${notifs.length} notifications.`, notifs);
	},
);

/**
 * Mark all notifications in this user's inbox as read.
 *
 * @name POST /api/v1/users/:userID/notifications/mark-all-read
 */
API_V1_ROUTER.add(
	"POST /users/:userID/notifications/mark-all-read",
	withRequestedUser,
	withSelf,
	async ({ ctx, req }) => {
		const { requestedUser: user } = ctx;

		const { markedCount } = await ACTION_MarkAllNotificationsRead(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{},
		);

		return success(`Marked ${markedCount} notifications as read.`, {});
	},
);

/**
 * Clear all notifications from your inbox.
 *
 * @name POST /api/v1/users/:userID/notifications/delete-all
 */
API_V1_ROUTER.add(
	"POST /users/:userID/notifications/delete-all",
	withRequestedUser,
	withSelf,
	async ({ ctx, req }) => {
		const { requestedUser: user } = ctx;

		const { deletedCount } = await ACTION_DeleteAllNotifications(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{},
		);

		return success(`Deleted ${deletedCount} notification(s).`, {});
	},
);
