import { SELECT_USER, ToUserDocument } from "#lib/db-formats/user";
import { success } from "#lib/router/typed-router";
import { SearchUsersRegExp } from "#lib/search/search";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { GetOnlineCutoff } from "#utils/user";

import { API_V1_ROUTER } from "../_singleton";

/**
 * Search users.
 *
 * @param online - Restrict returned users to those who are online.
 * @param search - Search for users where their name contains this string. If not present, returns
 * users sorted by last appearance.
 *
 * @name GET /api/v1/users
 */
API_V1_ROUTER.add("GET /users", async ({ input }) => {
	const onlyOnline = input.online !== undefined;
	const search = input.search;

	let users;

	if (search !== undefined) {
		users = await SearchUsersRegExp(search, onlyOnline);
	} else {
		let query = DB.selectFrom("account").select(SELECT_USER);

		if (onlyOnline) {
			const onlineCutoff = GetOnlineCutoff();

			query = query
				.where("account.last_seen", ">", UnixMillisecondsToISO8601(onlineCutoff))
				.orderBy("account.last_seen", "desc")
				.limit(100);
		}

		users = await query
			.orderBy("account.last_seen", "desc")
			.limit(100)
			.execute()
			.then((rows) => rows.map(ToUserDocument));
	}

	return success(`Returned ${users.length} users.`, users);
});
