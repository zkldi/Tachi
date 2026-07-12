import db from "#services/pg/db";
import { log } from "#utils/log";

import { MakeAnonAction } from "../actions";

export const ANON_ACTION_Register = MakeAnonAction(
	"REGISTER",
	async (_taker, { user_id, discord_id, "!api_token": api_token }) => {
		const existing = await db
			.selectFrom("priv_discord_user_map")
			.select("user_id")
			.where("user_id", "=", user_id)
			.executeTakeFirst();

		if (existing) {
			log.info(`Updating discord link for user_id=${user_id}`);

			await db
				.updateTable("priv_discord_user_map")
				.set({ discord_id, api_token })
				.where("user_id", "=", user_id)
				.execute();

			return { was_update: true };
		}

		await db
			.insertInto("priv_discord_user_map")
			.values({ user_id, discord_id, api_token })
			.execute();

		return { was_update: false };
	},
);
