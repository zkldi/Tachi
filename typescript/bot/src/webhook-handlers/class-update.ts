import { log } from "#utils/log";
import {
	type Classes,
	FormatGame,
	GetGameConfig,
	type integer,
	type V3Game,
	type WebhookEventClassUpdateV1,
} from "tachi-common";

import { Env } from "../config";
import { client } from "../main";
import { GetUGPTStats, GetUserInfo } from "../utils/api-requests";
import { CreateEmbed } from "../utils/embeds";
import { PrependTachiUrl } from "../utils/fetch-tachi";
import { FormatClass, GetGameChannel, UppercaseFirst } from "../utils/misc";

export async function HandleClassUpdateV1(
	event: WebhookEventClassUpdateV1["content"],
): Promise<integer> {
	const { game } = event;
	const isManualEntry = event.achievementSource === "manual";

	let channel;

	try {
		channel = GetGameChannel(client, game);
	} catch (e) {
		const err = e as Error;

		log.error(`ClassUpdate handler failed: ${err.message}`);
		return 500;
	}

	if (!isManualEntry && !ShouldRenderUpdate(game, event.set, event.new)) {
		log.info(
			`Not rendering class update ${event.set}: ${event.old} -> ${event.new} (not relevant).`,
		);
		return 204;
	}

	const userDoc = await GetUserInfo(event.userID);

	if (!isManualEntry) {
		const minimumNecessaryScores = GetMinimumScores(game, event.set);

		if (minimumNecessaryScores !== null) {
			const { totalScores } = await GetUGPTStats(userDoc.id, game);

			// Do not render if the user hasn't hit the score cap.
			if (totalScores < minimumNecessaryScores) {
				log.info(
					`Not rendering class update ${event.set}: ${event.old} -> ${event.new} (not enough scores).`,
				);
				return 204;
			}
		}
	}

	const newClass = FormatClass(game, event.set, event.new);

	const embedBase = CreateEmbed()
		.setURL(`${Env.TACHI_SERVER_LOCATION}/u/${userDoc.username}/games/${game}`)
		.setThumbnail(PrependTachiUrl(`/users/${userDoc.id}/pfp`));

	let embed;

	if (isManualEntry) {
		const classSetPretty = UppercaseFirst(String(event.set));

		let desc =
			"**⚠️ MANUAL UPDATE.**\n\n" +
			`**${userDoc.username}** manually set **their ${FormatGame(game)} · ${classSetPretty}** to **${newClass}**.\n\n`;

		if (event.old !== null) {
			desc += `\n\nPreviously saved: **${FormatClass(game, event.set, event.old)}**.`;
		} else {
			desc += `\n\nThere was **no saved ${classSetPretty.toLowerCase()}** on their profile before this entry.`;
		}

		embed = embedBase
			.setColor("#c0392b")
			.setTitle(`⚠️ MANUAL UPDATE - ${userDoc.username}`)
			.setDescription(desc);
	} else {
		embed = embedBase.setTitle(
			`${userDoc.username} just achieved ${newClass} in ${FormatGame(game)}!`,
		);

		if (event.old !== null) {
			embed.setDescription(
				`(This was raised from ${FormatClass(game, event.set, event.old)}.)`,
			);
		}
	}

	await channel.send({ embeds: [embed] });

	return 200;
}

/**
 * Returns Whether this class update is notable enough to be rendered or not.
 */
function ShouldRenderUpdate(game: V3Game, classSet: Classes[V3Game], classValue: string) {
	const config = GetGameConfig(game);
	const classSpec = config.classes[classSet];

	if (classSpec === undefined) {
		log.error(`Invalid class ${classSet} for ${game}`);
		return false;
	}

	if (classSpec.minimumRelevantValue === undefined) {
		return true;
	}

	const ids = classSpec.values.map((c) => c.id);

	const currentId = ids.indexOf(classValue);
	const minimumId = ids.indexOf(classSpec.minimumRelevantValue);

	if (currentId < 0) {
		log.error(`Invalid classValue ${classValue} for ${game}`);
		return false;
	}

	if (minimumId < 0) {
		log.error(`Invalid minimum classValue ${classValue} for ${game}`);
		return false;
	}

	return currentId >= minimumId;
}

function GetMinimumScores(game: V3Game, classSet: Classes[V3Game]): integer | null {
	const config = GetGameConfig(game);
	const classSpec = config.classes[classSet];

	if (classSpec === undefined) {
		log.error(`Invalid class ${classSet} for ${game}`);
		return null;
	}

	return classSpec.minimumScores ?? null;
}
