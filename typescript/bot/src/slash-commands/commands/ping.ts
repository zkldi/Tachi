import { SlashCommandBuilder } from "@discordjs/builders";

import type { SlashCommand } from "../../slash-commands/types";
import type { ServerStatus } from "../../utils/return-types";

import { ServerConfig } from "../../config";
import { TachiServerV1Get } from "../../utils/fetch-tachi";
import { VERSION_PRETTY } from "../../version";

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Checks the status of the bot and the site.")
		.toJSON(),
	exec: async (_interaction, requestingUser) => {
		const serverStatus = await TachiServerV1Get<ServerStatus>(
			"/status",
			requestingUser.api_token,
		);

		if (!serverStatus.success) {
			return `Failed to reach ${ServerConfig.NAME}. (${serverStatus.description})`;
		}

		return `Pong! We're live, and running ${VERSION_PRETTY}.
${ServerConfig.NAME} is up, and running ${serverStatus.body.version}.`;
	},
};

export default command;
