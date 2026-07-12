import type { ImportDocument, integer, UserDocument } from "tachi-common";

import { MessageEmbed } from "discord.js";

import { Env, ServerConfig } from "../config";
import { PrependTachiUrl } from "./fetch-tachi";
import { FormatDate, Pluralise } from "./misc";

export function CreateEmbed(userID?: integer) {
	const embed = new MessageEmbed()
		.setColor(ServerConfig.TYPE === "kamai" ? "#e61c6e" : "#527acc")
		.setTimestamp();

	if (userID !== undefined) {
		embed.setThumbnail(PrependTachiUrl(`/users/${userID}/pfp`));
	}

	return embed;
}

export function CreateImportEmbed(importDoc: ImportDocument) {
	return CreateEmbed()
		.setTitle(
			`Imported ${importDoc.scoreIDs.length} ${Pluralise(
				importDoc.scoreIDs.length,
				"score",
			)}!`,
		)
		.addField("Created Sessions", importDoc.createdSessions.length.toString(), true)
		.addField("Errors", importDoc.errors.length.toString(), true)
		.addField(
			"Your Profile",
			`${Env.TACHI_SERVER_LOCATION}/u/${importDoc.userID}/games/${importDoc.games[0]}`,
		);
}

export function CreateUserEmbed(userDoc: UserDocument) {
	return CreateEmbed()
		.setTitle(`${userDoc.username} (ID: ${userDoc.id})`)
		.setThumbnail(PrependTachiUrl(`/users/${userDoc.id}/pfp`))
		.setDescription(userDoc.status ?? "No status...")
		.addField("Join Date", FormatDate(userDoc.joinDate))
		.setURL(`${Env.TACHI_SERVER_LOCATION}/u/${userDoc.username}`);
}
