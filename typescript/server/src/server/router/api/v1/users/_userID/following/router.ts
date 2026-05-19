import { ACTION_FollowUser } from "#actions/follow-user";
import { ACTION_UnfollowUser } from "#actions/unfollow-user";
import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetFollowingForUser } from "#utils/queries/settings";
import { GetUsersWithIDs } from "#utils/user";

/**
 * Retrieve who this user is following.
 *
 * @note Following a user means you get updates from them in your global activity feed.
 *
 * @name GET /api/v1/users/:userID/following
 */
API_V1_ROUTER.add("GET /users/:userID/following", withRequestedUser, async ({ ctx }) => {
	const followingIDs = await GetFollowingForUser(ctx.requestedUser.id);
	const friends = await GetUsersWithIDs(followingIDs);

	return success(`Found ${friends.length} friend${friends.length !== 1 ? "s" : ""}.`, {
		friends,
	});
});

/**
 * Follow a new user.
 *
 * @param userID - The user to follow.
 *
 * @name POST /api/v1/users/:userID/following/add
 */
API_V1_ROUTER.add(
	"POST /users/:userID/following/add",
	withRequestedUser,
	withSelf,
	async ({ input, req }) => {
		const user = req.session.tachi!.user;
		const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

		const result = await ACTION_FollowUser(taker, { userID: input.userID });

		return success(`Added ${result.username}.`, {});
	},
);

/**
 * Unfollow a user.
 *
 * @param userID - The user to unfollow.
 *
 * @name POST /api/v1/users/:userID/following/remove
 */
API_V1_ROUTER.add(
	"POST /users/:userID/following/remove",
	withRequestedUser,
	withSelf,
	async ({ input, req }) => {
		const user = req.session.tachi!.user;
		const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

		const result = await ACTION_UnfollowUser(taker, { userID: input.userID });

		return success(`Unfollowed ${result.username}.`, {});
	},
);
