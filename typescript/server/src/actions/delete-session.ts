import { MakeAction } from "#lib/actions/actions";
import { LoadSessionDocumentById } from "#lib/db-formats/session";
import { DeleteMultipleScores } from "#lib/score-mutation/delete-scores";
import { GetScoresFromSession } from "#utils/session";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_DeleteSession = MakeAction("DELETE_SESSION", async (taker, { id }) => {
	const session = await LoadSessionDocumentById(id);

	if (!session) {
		throw new ExpectedErr(404, "This session does not exist.");
	}

	if (session.userID !== taker.acct.id && !(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorised to perform this action.");
	}

	const scores = await GetScoresFromSession(session);
	await DeleteMultipleScores(scores);

	return {};
});
