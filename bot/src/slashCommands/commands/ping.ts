import { ServerConfig } from "../../config";
import { TachiServerV1Get } from "../../utils/fetchTachi";
import { VERSION_PRETTY } from "../../version";
import { SlashCommandBuilder } from "@discordjs/builders";
import type { ServerStatus } from "../../utils/returnTypes";
import type { SlashCommand } from "../types";

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Checks the status of the bot and the site.")
		.toJSON(),
	exec: async (interaction, requestingUser) => {
		const serverStatus = await TachiServerV1Get<ServerStatus>(
			"/status",
			requestingUser.tachiApiToken
		);

		if (!serverStatus.success) {
			return `Failed to reach ${ServerConfig.NAME}. (${serverStatus.description})`;
		}

		return `Pong! We're live, and running ${VERSION_PRETTY}.
${ServerConfig.NAME} is up, and running ${serverStatus.body.version}.`;
	},
};

export default command;
