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

function buildImportResultEmbed(
	userID: integer,
	games: ImportDocument["games"],
	scoreCount: number,
	sessionCount: number,
	errorCount: number,
) {
	const profileUrl =
		games.length > 0
			? `${Env.TACHI_SERVER_LOCATION}/u/${userID}/games/${games[0]}`
			: `${Env.TACHI_SERVER_LOCATION}/u/${userID}`;

	return CreateEmbed()
		.setTitle(`Imported ${scoreCount} ${Pluralise(scoreCount, "score")}!`)
		.addField("Created Sessions", sessionCount.toString(), true)
		.addField("Errors", errorCount.toString(), true)
		.addField("Your Profile", profileUrl);
}

export function CreateImportEmbed(importDoc: ImportDocument) {
	return buildImportResultEmbed(
		importDoc.userID,
		importDoc.games,
		importDoc.scoreIDs.length,
		importDoc.createdSessions.length,
		importDoc.errors.length,
	);
}

/** Same embed as {@link CreateImportEmbed}, built from the `/sync` action summary. */
export function CreateImportEmbedFromSyncResult(result: {
	error_count: number;
	games: string[];
	score_count: number;
	session_count: number;
	user_id: integer;
}) {
	return buildImportResultEmbed(
		result.user_id,
		result.games as ImportDocument["games"],
		result.score_count,
		result.session_count,
		result.error_count,
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
