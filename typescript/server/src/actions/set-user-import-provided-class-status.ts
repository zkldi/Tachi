import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_SetUserImportProvidedClassStatus = MakeAction(
	"SET_USER_IMPORT_PROVIDED_CLASS_STATUS",
	async (taker, { userID, canImport }) => {
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
			.set({ can_import_provided_class: canImport })
			.where("id", "=", userID)
			.execute();

		return {};
	},
);
