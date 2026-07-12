import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { success } from "#lib/router/typed-router";
import { SearchFolders, SearchForChartHash, SearchUsersRegExp } from "#lib/search/search";
import { SearchGamesSongsCharts } from "#lib/search/song-charts";
import { GetAllUserRivals, GetUserPlayedGames } from "#utils/user";
import { type integer, type UserDocument, type V3Game } from "tachi-common";

import { API_V1_ROUTER } from "../_singleton";

/**
 * Performs a generic "search" across Tachi.
 *
 * @param search - The criteria to search on.
 *
 * @name GET /api/v1/search
 */
API_V1_ROUTER.add("GET /search", async ({ input, req }) => {
	const userID = req[SYMBOL_TACHI_API_AUTH].userID;

	let relevantGames: Array<V3Game> | null = null;

	if (userID !== null) {
		const games = await GetUserPlayedGames(userID);

		relevantGames = games;
	}

	const [users, charts, folders] = await Promise.all([
		SearchUsersRegExp(input.search),
		SearchGamesSongsCharts(input.search, relevantGames),
		SearchFolders(input.search, relevantGames),
	]);

	// @ts-expect-error mutating after the fact
	const usersWithRivalTag: Array<{ __isRival: boolean } & UserDocument> = users;

	let rivals: Array<integer> = [];

	if (userID !== null) {
		rivals = await GetAllUserRivals(userID);
	}

	for (const user of usersWithRivalTag) {
		user.__isRival = rivals.includes(user.id);
	}

	return success("Searched everything.", { charts, folders, users });
});

/**
 * Search checksums for charts, instead of matching on song title.
 *
 * @param search - The hash to search on.
 *
 * @note This matches MD5 and SHA256 for BMS/PMS, GSv3 for ITG and SHA1 for USC.
 */
API_V1_ROUTER.add("GET /search/chart-hash", async ({ input }) => {
	const buckets = await SearchForChartHash(input.search);
	const charts = Object.values(buckets).flatMap((hits) => hits.map((h) => h.chart));

	return success(`Searched for chart hash ${input.search}.`, { charts });
});
