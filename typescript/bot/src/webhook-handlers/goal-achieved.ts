import { Env } from "#config";
import { PrependTachiUrl } from "#utils/fetch-tachi";
import { log } from "#utils/log";
import {
	FormatGame,
	type GoalDocument,
	type integer,
	type WebhookEventGoalAchievedV1,
} from "tachi-common";

import { client } from "../main";
import { GetGoalWithID, GetUserInfo } from "../utils/api-requests";
import { CreateEmbed } from "../utils/embeds";
import { GetGameChannel, Pluralise } from "../utils/misc";

export async function HandleGoalAchievedV1(
	event: WebhookEventGoalAchievedV1["content"],
): Promise<integer> {
	const { game } = event;

	let channel;

	try {
		channel = GetGameChannel(client, game);
	} catch (e) {
		const err = e as Error;

		log.error(`ClassUpdate handler failed: ${err.message}`);
		return 500;
	}

	const userDoc = await GetUserInfo(event.userID);

	const goalDocuments = await Promise.all(
		event.goals.map((e) => GetGoalWithID(e.goalID, e.game)),
	);

	const goalMap = new Map<string, GoalDocument>();

	for (const goalDoc of goalDocuments) {
		goalMap.set(goalDoc.goalID, goalDoc);
	}

	const embed = CreateEmbed(userDoc.id)
		.setTitle(
			`${userDoc.username} just achieved ${event.goals.length} ${Pluralise(
				event.goals.length,
				"goal",
			)}!`,
		)
		.setThumbnail(PrependTachiUrl(`/users/${userDoc.id}/pfp`))
		.setURL(`${Env.TACHI_SERVER_LOCATION}/u/${userDoc.username}`)
		.addFields(
			event.goals.map((e) => {
				const goal = goalMap.get(e.goalID)!;

				// if the outOf value changed (it might), note that
				// in the embed.
				const value =
					e.old.outOf === e.new.outOf
						? `${e.old.progressHuman} -> ${e.new.progressHuman}`
						: `${e.old.progressHuman}/${e.old.outOfHuman} -> ${e.new.progressHuman}/${e.new.outOfHuman}`;

				return {
					name: `${goal.name} (${FormatGame(e.game)})`,
					value,
				};
			}),
		);

	await channel.send({ embeds: [embed] });

	return 200;
}
