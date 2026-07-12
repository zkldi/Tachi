import { GetRecentActivityForMultipleGames } from "#lib/activity/activity";
import { success } from "#lib/router/typed-router";
import { ALL_GAMES } from "tachi-common";

import { API_V1_ROUTER } from "../_singleton";

async function globalActivityImpl(input: { startTime?: number }) {
	const data = await GetRecentActivityForMultipleGames(
		ALL_GAMES,
		undefined,
		input.startTime ?? null,
	);

	return success(`Returned global activity.`, data);
}

/**
 * Retrieve *all* activity across every game on the site.
 *
 * @param session - See CreateActivityRouteHandler
 * @param startTime - See CreateActivityRouteHandler
 */
API_V1_ROUTER.add("GET /activity", ({ input }) => globalActivityImpl(input));

/**
 * Same behavior as `GET /activity`. Some browser blocklists match `/activity`;
 * use this path when an ad blocker interferes.
 */
API_V1_ROUTER.add("GET /ublock-blocks-this", ({ input }) => globalActivityImpl(input));
