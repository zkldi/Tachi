import DB from "#services/pg/db";
import { sql } from "kysely";
import { FormatGame, type integer, type UserDocument, type V3Game } from "tachi-common";

import { BulkSendNotification, SendNotification } from "./notifications";

/**
 * A utility wrapper for sending the RIVALED_BY notification.
 *
 * @param toUserID - The user to send this notification to.
 * @param fromUser - The user who rivalled them.
 * @param game - The game they rivalled them on.
 * @param playtype - The playtype they rivalled them on.
 */
export async function SendSetRivalNotification(
	toUserID: integer,
	fromUser: UserDocument,
	game: V3Game,
) {
	const body = {
		type: "RIVALED_BY" as const,
		content: { userID: fromUser.id, game },
	};

	const alreadyBeenPinged = await DB.selectFrom("notification")
		.select("row_id")
		.where("sent_to", "=", toUserID)
		.where("kind", "=", "rivaled_by")
		.where(sql<boolean>`payload @> ${JSON.stringify(body)}::jsonb`)
		.executeTakeFirst();

	if (alreadyBeenPinged) {
		return;
	}

	return SendNotification(
		`${fromUser.username} just added you as a rival for ${FormatGame(game)}`,
		toUserID,
		{
			type: "RIVALED_BY",
			content: {
				userID: fromUser.id,
				game,
			},
		},
	);
}

export async function SendSiteAnnouncementNotification(title: string, maybeGame?: V3Game) {
	let toUserIDs: integer[];

	if (maybeGame) {
		const rows = await DB.selectFrom("game_profile")
			.select("user_id")
			.where("game", "=", maybeGame)
			.execute();
		toUserIDs = rows.map((e) => e.user_id);
	} else {
		const rows = await DB.selectFrom("account").select("id").execute();
		toUserIDs = rows.map((e) => e.id);
	}

	return BulkSendNotification(title, toUserIDs, {
		type: "SITE_ANNOUNCEMENT",
		content: {},
	});
}
