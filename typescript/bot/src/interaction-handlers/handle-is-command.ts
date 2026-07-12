import { type RequestingUser } from "#slash-commands/types";
import { log } from "#utils/log";
import { type CommandInteraction, MessageEmbed } from "discord.js";

import { Env } from "../config";
import { SLASH_COMMANDS } from "../slash-commands/commands";

/**
 * Handles incoming command requests by resolving the interaction to the command
 * it refers to, and calling it.
 *
 * @param interaction - The interaction the user made. This contains things like what
 * command they called and with what arguments.
 * @param requestingUser - The user who interacted with this command.
 */
export async function handleIsCommand(
	interaction: CommandInteraction,
	requestingUser: RequestingUser,
) {
	try {
		const command = SLASH_COMMANDS.get(interaction.commandName);

		if (!command) {
			throw new Error(`A command was requested that does not exist.`);
		}

		if (Env.DISCORD_LIMBO_CHANNEL) {
			const inLimbo = interaction.channelId === Env.DISCORD_LIMBO_CHANNEL;

			if (command.limboOnly && !inLimbo) {
				await interaction.reply({
					content: `\`/${command.info.name}\` can only be used in <#${Env.DISCORD_LIMBO_CHANNEL}>.`,
					ephemeral: true,
				});
				return;
			}

			if (!command.limboOnly && inLimbo) {
				await interaction.reply({
					content: `This command cannot be used in <#${Env.DISCORD_LIMBO_CHANNEL}>. Please use it in the appropriate channel.`,
					ephemeral: true,
				});
				return;
			}
		}

		await interaction.deferReply();

		log.debug(`Running ${command.info.name} interaction.`);
		try {
			const response = await command.exec(interaction, requestingUser);

			if (response instanceof MessageEmbed) {
				await interaction.editReply({ embeds: [response] });
			} else if (response !== null) {
				await interaction.editReply(response);
			} else {
				await interaction.editReply({
					content: "Done!",
				});
			}
		} catch (err) {
			log.error({ command, err }, `An error occurred while executing a command.`);

			void interaction.editReply(
				`An error has occurred while executing this command (${err}). This has been reported.`,
			);
		}
	} catch (e) {
		log.error({ error: e }, "Failed to handle isCommand interaction");
	}
}
