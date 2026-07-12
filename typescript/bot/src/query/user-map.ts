import type { integer } from "tachi-common";

import db from "#services/pg/db";
import { type RequestingUser } from "#slash-commands/types";
import { log } from "#utils/log";

export async function GetUserAndTokenForDiscordID(
	discordID: string,
): Promise<RequestingUser | null> {
	log.debug(`Fetching linked user & token with DiscordID: ${discordID}.`);

	const row = await db
		.selectFrom("priv_discord_user_map")
		.innerJoin("account", "priv_discord_user_map.user_id", "account.id")
		.select(["api_token", "user_id", "discord_id", "account.username"])
		.where("discord_id", "=", discordID)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return {
		acct: { id: row.user_id, username: row.username },
		api_token: row.api_token,
		discord_id: row.discord_id,
	};
}

export async function GetUserIDForDiscordID(discordID: string): Promise<integer | null> {
	log.debug(`Fetching linked userID with DiscordID: ${discordID}.`);

	const row = await db
		.selectFrom("priv_discord_user_map")
		.select("user_id")
		.where("discord_id", "=", discordID)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return row.user_id;
}
