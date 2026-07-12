import { MakeAction } from "#lib/actions/actions";
import { rebuildFolderChartLookup } from "#lib/folders/rebuild-folder-chart-lookup";
import DB from "#services/pg/db";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_RebuildFolderChartLookup = MakeAction(
	"REBUILD_FOLDER_CHART_LOOKUP",
	async (taker, { folderId }) => {
		if (!(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		return rebuildFolderChartLookup(DB, { folderId });
	},
);
