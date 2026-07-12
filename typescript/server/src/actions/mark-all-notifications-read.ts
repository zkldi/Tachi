import { MakeAction } from "#lib/actions/actions";
import { ONE_SECOND } from "#lib/constants/time";
import DB from "#services/pg/db";

export const ACTION_MarkAllNotificationsRead = MakeAction(
	"MARK_ALL_NOTIFICATIONS_READ",
	async (taker) => {
		// If a notification arrives at exactly the same moment the user clears their
		// inbox, they risk never seeing it. Excluding notifications sent in the last
		// two seconds makes that window negligibly small.
		const cutoff = new Date(Date.now() - ONE_SECOND * 2).toISOString();

		const rows = await DB.updateTable("notification")
			.set({ read: true })
			.where("sent_to", "=", taker.acct.id)
			.where("sent_at", "<", cutoff)
			.returning("row_id")
			.execute();

		return { markedCount: rows.length };
	},
);
