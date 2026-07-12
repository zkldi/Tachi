import { Env } from "#config";
import { PrependTachiUrl } from "#utils/fetch-tachi";
import { log } from "#utils/log";
import { FormatGame, type integer, type WebhookEventQuestAchievedV1 } from "tachi-common";

import { client } from "../main";
import { GetQuestWithID, GetUserInfo } from "../utils/api-requests";
import { CreateEmbed } from "../utils/embeds";
import { GetGameChannel } from "../utils/misc";

export async function HandleQuestAchievedV1(
	event: WebhookEventQuestAchievedV1["content"],
): Promise<integer> {
	const { game } = event;

	let channel;

	try {
		channel = GetGameChannel(client, game);
	} catch (e) {
		const err = e as Error;

		log.error({ err }, "ClassUpdate handler failed.");
		return 500;
	}

	const userDoc = await GetUserInfo(event.userID);

	const quest = await GetQuestWithID(event.questID, game);

	const embed = CreateEmbed(userDoc.id)
		.setThumbnail(PrependTachiUrl(`/users/${userDoc.id}/pfp`))
		.setURL(`${Env.TACHI_SERVER_LOCATION}/u/${userDoc.username}`)
		.setTitle(
			`${userDoc.username} just completed the ${quest.name} (${FormatGame(game)}) quest!`,
		);

	await channel.send({ embeds: [embed] });

	return 200;
}
