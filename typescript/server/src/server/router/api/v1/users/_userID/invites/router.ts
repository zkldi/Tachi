import { ACTION_CreateInvite } from "#actions/create-invite";
import { SELECT_INVITE, ToInviteDocument } from "#lib/db-formats/invite";
import { GetTotalAllowedInvites } from "#lib/invites/invites";
import { withInvitesEnabled, withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { GetUsersWithIDs } from "#utils/user";
import { sql } from "kysely";

/**
 * Retrieve all of this users created invites.
 *
 * @name GET /api/v1/users/:userID/invites
 */
API_V1_ROUTER.add(
	"GET /users/:userID/invites",
	withInvitesEnabled,
	withRequestedUser,
	withSelf,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const rows = await DB.selectFrom("priv_invite")
			.select(SELECT_INVITE)
			.where("priv_invite.created_by", "=", user.id)
			.orderBy(sql`priv_invite.consumed_at desc nulls last`)
			.execute();

		const invites = rows.map(ToInviteDocument);

		const consumers = await GetUsersWithIDs(
			invites.map((e) => e.consumedBy).filter((e) => e !== null) as Array<number>,
		);

		return success(`Found ${invites.length} invites.`, { consumers, invites });
	},
);

/**
 * Return how many invites this user can create, and how many they
 * have already created.
 *
 * @name GET /api/v1/users/:userID/invites/limit
 */
API_V1_ROUTER.add(
	"GET /users/:userID/invites/limit",
	withInvitesEnabled,
	withRequestedUser,
	withSelf,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const { count } = await DB.selectFrom("priv_invite")
			.select(DB.fn.countAll().as("count"))
			.where("priv_invite.created_by", "=", user.id)
			.executeTakeFirstOrThrow();

		return success("Calculated invite limit.", {
			invites: Number(count),
			limit: GetTotalAllowedInvites(user),
		});
	},
);

/**
 * Create a new invite.
 *
 * @name POST /api/v1/users/:userID/invites/create
 */
API_V1_ROUTER.add(
	"POST /users/:userID/invites/create",
	withInvitesEnabled,
	withRequestedUser,
	withSelf,
	async ({ ctx, req }) => {
		const { requestedUser: user } = ctx;
		const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

		const inviteDoc = await ACTION_CreateInvite(taker, {});

		return success("Created Invite.", inviteDoc);
	},
);
