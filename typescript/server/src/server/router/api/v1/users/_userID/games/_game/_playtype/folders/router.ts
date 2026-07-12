import { GetEnumDistForFolders, GetRecentlyViewedFolders } from "#lib/folders/folders";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { SearchFoldersForGameFtsAndTrgm } from "#lib/search/folders";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";

/**
 * Search folders with user grade+lamp distribution.
 *
 * @name GET /api/v1/users/:userID/games/:game/folders
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/folders",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;

		const onlyActiveFolders = input.inactive === undefined;
		const folders = await SearchFoldersForGameFtsAndTrgm(game, input.search, {
			limit: 20,
			onlyActiveFolders,
		});

		const stats = await GetEnumDistForFolders(user.id, folders);

		return success(`Returned ${stats.length} folders.`, { folders, stats });
	},
);

/**
 * Get a users most recently interacted with folders.
 *
 * @name GET /api/v1/users/:userID/games/:game/folders/recent
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/folders/recent",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const { views, folders } = await GetRecentlyViewedFolders(user.id, game);
		const stats = await GetEnumDistForFolders(user.id, folders);

		return success(`Returned ${views.length} recently interacted with folders.`, {
			folders,
			stats,
			views,
		});
	},
);
