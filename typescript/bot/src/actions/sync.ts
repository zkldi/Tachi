import { ExpectedErr } from "bliss";

import { MakeAction } from "../actions";
import { PerformScoreImport } from "../utils/api-requests";

export const ACTION_Sync = MakeAction(
	"SYNC",
	async (_taker, { import_type, "!api_token": api_token }) => {
		const importDoc = await PerformScoreImport(`/import/from-api`, api_token, {
			importType: import_type,
		});

		if (typeof importDoc === "string") {
			throw new ExpectedErr(400, importDoc);
		}

		return {
			import_id: importDoc.importID,
			score_count: importDoc.scoreIDs.length,
			session_count: importDoc.createdSessions.length,
			error_count: importDoc.errors.length,
			user_id: importDoc.userID,
			games: importDoc.games,
		};
	},
);
