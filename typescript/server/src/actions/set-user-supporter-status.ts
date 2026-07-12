import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_SetUserSupporterStatus = MakeAction(
	"SET_USER_SUPPORTER_STATUS",
	async (taker, { userID, isSupporter }) => {
		if (!(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		const existing = await DB.selectFrom("account")
			.select("id")
			.where("id", "=", userID)
			.executeTakeFirst();

		if (!existing) {
			throw new ExpectedErr(404, "This user does not exist.");
		}

		await DB.updateTable("account")
			.set({ is_supporter: isSupporter })
			.where("id", "=", userID)
			.execute();

		return {};
	},
);
