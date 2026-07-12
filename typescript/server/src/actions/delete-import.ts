import { MakeAction } from "#lib/actions/actions";
import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import { RevertImport } from "#lib/imports/imports";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_DeleteImport = MakeAction("DELETE_IMPORT", async (taker, { id }) => {
	const importDoc = await LoadImportDocumentById(id);

	if (!importDoc) {
		throw new ExpectedErr(404, "This import does not exist.");
	}

	if (importDoc.userID !== taker.acct.id && !(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorised to perform this action.");
	}

	const err = await RevertImport(importDoc);

	if (err !== null) {
		throw new ExpectedErr(409, "You already have an import or a revert ongoing.");
	}

	return {};
});
