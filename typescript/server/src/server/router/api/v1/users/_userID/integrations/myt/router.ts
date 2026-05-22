import { ACTION_DeleteMytCardInfo } from "#actions/delete-myt-card-info";
import { ACTION_UpdateMytCardInfo } from "#actions/update-myt-card-info";
import { SELECT_MYT_CARD_INFO, ToMytCardInfo } from "#lib/db-formats/myt-card-info";
import { withKamaitachi, withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";

/**
 * Retrieve this user's card info (cardAccessCode).
 *
 * @name GET /api/v1/users/:userID/integrations/myt
 */
API_V1_ROUTER.add(
	"GET /users/:userID/integrations/myt",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const row = await DB.selectFrom("priv_svc_myt_card_info")
			.select(SELECT_MYT_CARD_INFO)
			.where("user_id", "=", user.id)
			.executeTakeFirst();

		return success(
			row ? `Found card info.` : `User has no card info set.`,
			row ? ToMytCardInfo(row) : null,
		);
	},
);

/**
 * Write new card details for Myt.
 *
 * @name PUT /api/v1/users/:userID/integrations/myt
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/integrations/myt",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;
		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		await ACTION_UpdateMytCardInfo(taker, { cardAccessCode: input.cardAccessCode });

		return success("Updated cardAccessCode.", {});
	},
);

/**
 * Unset this user's card details for Myt.
 *
 * @name DELETE /api/v1/users/:userID/integrations/myt
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/integrations/myt",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ ctx, req }) => {
		const { requestedUser: user } = ctx;
		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		await ACTION_DeleteMytCardInfo(taker, {});

		return success("Deleted stored card info.", {});
	},
);
