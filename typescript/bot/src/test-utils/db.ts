/**
 * Database helpers for action tests.
 *
 * Sets up the FK chain that most tables depend on:
 *   account → priv_api_token → priv_discord_user_map
 */

import db from "#services/pg/db";

export interface TestAccount {
	id: number;
	username: string;
	apiToken: string;
}

/**
 * Insert a minimal account + API token row so that FK constraints on
 * priv_discord_user_map and the action table are satisfied.
 */
export async function createTestAccount(
	username = "testuser",
	token = "test-token-aaaa",
): Promise<TestAccount> {
	const { id } = await db
		.insertInto("account")
		.values({ username, about: "Test user for tests." })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("priv_api_token")
		.values({ token, user_id: id, identifier: "test" })
		.execute();

	return { id: Number(id), username, apiToken: token };
}
