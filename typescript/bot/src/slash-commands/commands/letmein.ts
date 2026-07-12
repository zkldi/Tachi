import { Env } from "#config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ExpectedErr } from "bliss";
import { GuildMember } from "discord.js";

import type { SlashCommand } from "../types";

import { ANON_ACTION_Letmein } from "../../anon-actions/letmein";

const command: SlashCommand = {
	info: new SlashCommandBuilder()
		.setName("letmein")
		.setDescription("Let yourself into the server.")
		.toJSON(),
	limboOnly: true,
	exec: async (interaction) => {
		if (!Env.DISCORD_APPROVED_ROLE) {
			return null; // no-op
		}

		if (!(interaction.member instanceof GuildMember)) {
			return null;
		}

		try {
			await ANON_ACTION_Letmein(
				{ ip: null },
				{
					discord_user_id: interaction.user.id,
					role_id: Env.DISCORD_APPROVED_ROLE,
					"!member": interaction.member,
				},
			);
		} catch (e) {
			if (ExpectedErr.is(e)) {
				return e.reason;
			}

			throw e;
		}

		return null;
	},
};

export default command;
