import {
	ListFailedImportTrackers,
	ListRecentImportDocuments,
} from "#lib/db-formats/import-document";
import { withRequestedUser } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";

/**
 * Query this user's imports. Returns the 500 most recently-finished imports.
 *
 * @param importType - Optionally, limit the returns to only this import type.
 * @param userIntent - Optionally, limit returns to only those with or without userIntent.
 *
 * @name GET /api/v1/users/:userID/imports
 */
API_V1_ROUTER.add("GET /users/:userID/imports", withRequestedUser, async ({ input, ctx }) => {
	const userIntent = input.userIntent === undefined ? undefined : input.userIntent === "true";

	const imports = await ListRecentImportDocuments({
		importType: input.importType as never,
		limit: 500,
		userId: ctx.requestedUser.id,
		userIntent,
	});

	return success(`Found ${imports.length} imports.`, imports);
});

/**
 * Return this users 500 most recent failed imports.
 *
 * @param userIntent - Optionally, Whether to limit returns to only those with userIntent or without.
 * @param importType - Optionally, Whether to limit returns to only a specific importType.
 *
 * @name GET /api/v1/users/:userID/imports/failed
 */
API_V1_ROUTER.add(
	"GET /users/:userID/imports/failed",
	withRequestedUser,
	async ({ input, ctx }) => {
		const userIntent = input.userIntent === undefined ? undefined : input.userIntent === "true";

		const trackers = await ListFailedImportTrackers({
			importType: input.importType as never,
			limit: 500,
			userId: ctx.requestedUser.id,
			userIntent,
		});

		return success(`Found ${trackers.length} failed imports.`, trackers);
	},
);
