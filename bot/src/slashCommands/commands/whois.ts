import { ServerConfig } from "../../config";
import { GetUserIDForDiscordID } from "../../database/queries";
import { GetUserInfo } from "../../utils/apiRequests";
import { CreateUserEmbed } from "../../utils/embeds";
import { SlashCommandBuilder } from "@discordjs/builders";
import type { SlashCommand } from "../types";

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("whois")
		.setDescription(`Return the ${ServerConfig.NAME} profile of a discord user.`)
		.addUserOption((user) =>
			user.setName("user").setDescription("The user to check for.").setRequired(true)
		)
		.toJSON(),
	exec: async (interaction) => {
		const discordUser = interaction.options.getUser("user", true);

		const userID = await GetUserIDForDiscordID(discordUser.id);

		if (userID === null) {
			return `This user is not linked with the bot.`;
		}

		const user = await GetUserInfo(userID);

		return CreateUserEmbed(user);
	},
};

export default command;
