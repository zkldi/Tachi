import { ACTION_UpdateUserSettings } from "#actions/update-user-settings";
import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetSettingsForUser } from "#utils/user";

/**
 * Retrieve this user's settings. Note that these settings are NOT private.
 *
 * @name GET /api/v1/users/:userID/settings
 */
API_V1_ROUTER.add("GET /users/:userID/settings", withRequestedUser, async ({ ctx }) => {
	const settings = await GetSettingsForUser(ctx.requestedUser.id);

	return success("Retrieved settings.", settings);
});

/**
 * Update a user's settings.
 *
 * @param invisible - Whether to set the user to invisible or not.
 * @param developerMode - Whether to display developer specific information in the WebUI.
 * @param advancedMode - Whether to display more advanced options in the WebUI.
 * @param contentiousContent - Whether to display slightly inappropriate splash messages.
 * @param deletableScores - Whether scores can be deleted.
 *
 * @name PATCH /api/v1/users/:userID/settings
 */
API_V1_ROUTER.add(
	"PATCH /users/:userID/settings",
	withRequestedUser,
	withSelf,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;
		const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

		await ACTION_UpdateUserSettings(taker, {
			advancedMode: input.advancedMode,
			contentiousContent: input.contentiousContent,
			deletableScores: input.deletableScores,
			developerMode: input.developerMode,
			invisible: input.invisible,
		});

		const settings = await GetSettingsForUser(user.id);

		if (req.session.tachi?.settings) {
			req.session.tachi.settings = settings;
		}

		return success("Updated settings.", settings);
	},
);
