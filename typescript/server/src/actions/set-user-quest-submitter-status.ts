import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_SetUserQuestSubmitterStatus = MakeAction(
	"SET_USER_QUEST_SUBMITTER_STATUS",
	async (taker, { userID, canSubmit }) => {
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
			.set({ can_submit_quests: canSubmit })
			.where("id", "=", userID)
			.execute();

		return {};
	},
);
