import { MakeAction } from "#lib/actions/actions";
import { ONE_SECOND } from "#lib/constants/time";
import DB from "#services/pg/db";

export const ACTION_DeleteAllNotifications = MakeAction(
	"DELETE_ALL_NOTIFICATIONS",
	async (taker) => {
		// See mark-all-notifications-read.ts for an explanation of this two-second buffer.
		const cutoff = new Date(Date.now() - ONE_SECOND * 2).toISOString();

		const rows = await DB.deleteFrom("notification")
			.where("sent_to", "=", taker.acct.id)
			.where("sent_at", "<", cutoff)
			.returning("row_id")
			.execute();

		return { deletedCount: rows.length };
	},
);
