import { ACTION_UpdateKshookSv6cSettings } from "#actions/update-kshook-sv6c-settings";
import {
	SELECT_KSHOOK_SV6C_SETTINGS,
	ToKshookSv6cSettings,
} from "#lib/db-formats/kshook-sv6c-settings";
import { withKamaitachi, withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

/**
 * Retrieve your KsHook SV6C settings.
 *
 * @name GET /api/v1/users/:userID/integrations/kshook-sv6c/settings
 */
API_V1_ROUTER.add(
	"GET /users/:userID/integrations/kshook-sv6c/settings",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const row = await DB.selectFrom("svc_kshook_sv6c_settings")
			.select(SELECT_KSHOOK_SV6C_SETTINGS)
			.where("user_id", "=", user.id)
			.executeTakeFirst();

		return success("Retrieved KsHook (S6VC) settings.", row ? ToKshookSv6cSettings(row) : null);
	},
);

/**
 * Update your KsHook SV6C configuration.
 *
 * @param forceStaticImport - Whether or whether not to statically import data.
 *
 * @name PATCH /api/v1/users/:userID/integrations/kshook-sv6c/settings
 */
API_V1_ROUTER.add(
	"PATCH /users/:userID/integrations/kshook-sv6c/settings",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;
		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		if (input.forceStaticImport === undefined) {
			throw new ExpectedErr(400, "No modifications sent.");
		}

		const result = await ACTION_UpdateKshookSv6cSettings(taker, {
			forceStaticImport: input.forceStaticImport,
		});

		return success("Successfully updated settings.", { userID: user.id, ...result });
	},
);
