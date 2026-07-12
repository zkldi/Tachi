import { ACTION_PatchUserGameSettings } from "#actions/patch-user-game-settings";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { GetUserGameSettingsDocument } from "#lib/db-formats/user-game-settings";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetUserWithIDGuaranteed } from "#utils/user";
import { ExpectedErr } from "bliss";

/**
 * Returns this user's game settings.
 *
 * @name GET /api/v1/users/:userID/games/:game/settings
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/settings",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const settings = await GetUserGameSettingsDocument(user.id, game);

		return success(`Returned ${user.username}'s settings.`, settings);
	},
);

/**
 * Update user-game settings preferences.
 *
 * @name PATCH /api/v1/users/:userID/games/:game/settings
 */
API_V1_ROUTER.add(
	"PATCH /users/:userID/games/:game/settings",
	withUserGameProfile,
	async ({ ctx, input, req }) => {
		const { requestedUser: user, game } = ctx;

		const authUserID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (authUserID === null) {
			throw new ExpectedErr(401, "Authentication is required for this endpoint.");
		}

		const authedUser = await GetUserWithIDGuaranteed(authUserID);
		const taker = { acct: { id: authedUser.id, username: authedUser.username }, ip: req.ip };

		const { settings } = await ACTION_PatchUserGameSettings(taker, {
			game,
			preferences: input as Parameters<typeof ACTION_PatchUserGameSettings>[1]["preferences"],
			userID: user.id,
		});

		const description =
			Object.keys(input).length === 0
				? "Nothing has been modified, successfully."
				: "Updated settings.";

		return success(description, settings);
	},
);
