import { ACTION_CreateApiToken } from "#actions/create-api-token";
import { ACTION_DeleteApiToken } from "#actions/delete-api-token";
import { SELECT_API_TOKEN, ToAPITokenDocument } from "#lib/db-formats/api-token";
import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";

/**
 * Retrieve this user's API tokens.
 * This request MUST be performed with session-level auth.
 *
 * @name GET /api/v1/users/:userID/api-tokens
 */
API_V1_ROUTER.add("GET /users/:userID/api-tokens", withRequestedUser, withSelf, async ({ ctx }) => {
	const rows = await DB.selectFrom("priv_api_token")
		.select(SELECT_API_TOKEN)
		.where("priv_api_token.user_id", "=", ctx.requestedUser.id)
		.execute();

	return success(`Returned ${rows.length} keys.`, rows.map(ToAPITokenDocument));
});

/**
 * Create a new API token.
 *
 * @param clientID - Create a token that has the permissions implied from this client.
 * @param identifier - A user provided string to identify this API Key.
 * @param permissions - An array of strings dictating what permissions to create with.
 * This is incompatible with clientID.
 *
 * @name POST /api/v1/users/:userID/api-tokens/create
 */
API_V1_ROUTER.add(
	"POST /users/:userID/api-tokens/create",
	withRequestedUser,
	withSelf,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;

		const { token, wasExisting } = await ACTION_CreateApiToken(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{
				clientID: input.clientID,
				identifier: input.identifier,
				permissions: input.permissions,
			},
		);

		const tokenRow = await DB.selectFrom("priv_api_token")
			.select(SELECT_API_TOKEN)
			.where("priv_api_token.token", "=", token)
			.executeTakeFirstOrThrow();

		return success(
			wasExisting ? "Returned existing key." : "Successfully created new API Token.",
			ToAPITokenDocument(tokenRow),
		);
	},
);

/**
 * Delete this token.
 *
 * @name DELETE /api/v1/users/:userID/api-tokens/:token
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/api-tokens/:token",
	withRequestedUser,
	withSelf,
	async ({ params, ctx, req }) => {
		const { requestedUser: user } = ctx;

		await ACTION_DeleteApiToken(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{ token: params.token },
		);

		return success("Removed Token.", {});
	},
);
