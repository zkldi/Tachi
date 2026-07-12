import { SlashCommandBuilder } from "@discordjs/builders";

import type { SlashCommand } from "../types";

import { client } from "../../main";

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("invite")
		.setDescription("Invite this bot to another server.")
		.toJSON(),
	exec: () => `To invite me into another server, use this link:
https://discord.com/api/oauth2/authorize?client_id=${
		client.application!.id
	}&permissions=0&scope=bot%20applications.commands`,
};

export default command;
