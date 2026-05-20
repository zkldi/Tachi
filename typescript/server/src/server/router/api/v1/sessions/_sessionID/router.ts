import { ACTION_UpdateSession } from "#actions/update-session";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { GetSessionFolderRaises } from "#lib/folders/get-session-folder-raises";
import { withSession, withSessionOwner } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetAdjacentSessions, GetSessionData, GetSessionIndex } from "#utils/queries/sessions";
import { GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";

/**
 * Retrieves the session, its scores and the related songs and charts.
 *
 * @name GET /api/v1/sessions/:sessionID
 */
API_V1_ROUTER.add("GET /sessions/:sessionID", withSession, async ({ ctx }) => {
	const { sessionDoc: session } = ctx;
	const [sessionData, index] = await Promise.all([
		GetSessionData(session),
		GetSessionIndex(session),
	]);

	return success(`Successfully returned session ${session.name}.`, {
		charts: sessionData.charts,
		index,
		scoreInfo: sessionData.scoreInfo,
		scores: sessionData.scores,
		session,
		songs: sessionData.songs,
		user: sessionData.user,
	});
});

/**
 * Retrieves additional statistics about folder raises as a result of this session.
 *
 * More obviously, this endpoint returns stuff like "This session resulted in 4 more
 * hard clears on the Level 12 folder."
 *
 * This allows us to render pretty things in the UI, showing the user what their
 * best stats were.
 *
 * @name GET /api/v1/sessions/:sessionID/folder-raises
 */
API_V1_ROUTER.add("GET /sessions/:sessionID/folder-raises", withSession, async ({ ctx }) => {
	const raises = await GetSessionFolderRaises(ctx.sessionDoc);

	return success("Retrieved folder raises.", raises);
});

/**
 * Returns the chronologically adjacent sessions (prev = older, next = newer)
 * for the same user and game.
 *
 * @name GET /api/v1/sessions/:sessionID/adjacent
 */
API_V1_ROUTER.add("GET /sessions/:sessionID/adjacent", withSession, async ({ ctx }) => {
	const { prev, next } = await GetAdjacentSessions(ctx.sessionDoc);

	return success("Retrieved adjacent sessions.", { next, prev });
});

/**
 * Modifies a session.
 *
 * Requires the requester to be the owner of the session, alongside having the
 * customise_session permission.
 *
 * @param name - A new name for the session.
 * @param desc - A new desc for the session.
 * @param highlight - Update the highlighted state of the session with this.
 *
 * @name PATCH /api/v1/sessions/:sessionID
 */
API_V1_ROUTER.add(
	"PATCH /sessions/:sessionID",
	withSession,
	withSessionOwner,
	async ({ input, ctx, req }) => {
		const { sessionDoc: session } = ctx;

		const hasChanges =
			input.name !== undefined || input.desc !== undefined || input.highlight !== undefined;

		if (!hasChanges) {
			throw new ExpectedErr(400, "This request modifies nothing about this session.");
		}

		const auth = req[SYMBOL_TACHI_API_AUTH];

		if (auth.userID === null) {
			throw new ExpectedErr(401, "Authentication is required.");
		}

		const user = await GetUserWithID(auth.userID);

		if (!user) {
			throw new ExpectedErr(401, "Authentication is required.");
		}

		await ACTION_UpdateSession(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{
				desc: input.desc,
				highlight: input.highlight,
				name: input.name,
				sessionID: session.sessionID,
			},
		);

		return success("Updated Session.", {});
	},
);
