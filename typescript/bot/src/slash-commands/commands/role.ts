import { Env } from "#config";
import { log } from "#utils/log";
import { SlashCommandBuilder, type SlashCommandSubcommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";

import type { SlashCommand } from "../types";

import { SLASH_STRING_CHOICE_LIMIT, sortedSlashChoiceKeys } from "../slash-choice-limit";

function attachNamedRoleChoiceOption(
	sub: SlashCommandSubcommandBuilder,
	choices: [string, string][],
) {
	return sub.addStringOption((opt) =>
		opt
			.setName("name")
			.setRequired(true)
			.setDescription("Which subscription role (e.g. site announcements).")
			.addChoices(choices),
	);
}

/** Returns slash command `/role`, or null if there is nothing to expose. */
export function getRoleSlashCommand(): SlashCommand | null {
	const map = Env.DISCORD_OTHER_ROLES;
	if (Object.keys(map).length === 0) {
		return null;
	}

	const { keysIncluded, keysOmitted } = sortedSlashChoiceKeys(
		Object.keys(map),
		SLASH_STRING_CHOICE_LIMIT,
	);

	if (keysOmitted.length > 0) {
		log.warn(
			{
				total: keysIncluded.length + keysOmitted.length,
				limit: SLASH_STRING_CHOICE_LIMIT,
				ignoredKeys: [...keysOmitted],
			},
			`DISCORD_OTHER_ROLES exceeds Discord's slash choice limit; only the first ${SLASH_STRING_CHOICE_LIMIT} keys (alphabetically) appear in \`/role\`.`,
		);
	}

	const choiceTuples: [string, string][] = keysIncluded.map((k): [string, string] => [k, k]);

	const command: SlashCommand = {
		info: new SlashCommandBuilder()
			.setName("role")
			.setDescription("Add or remove opt-in Discord roles (e.g. announcements).")
			.addSubcommand((sub) =>
				attachNamedRoleChoiceOption(
					sub.setName("add").setDescription("Subscribe to one of these roles."),
					choiceTuples,
				),
			)
			.addSubcommand((sub) =>
				attachNamedRoleChoiceOption(
					sub.setName("remove").setDescription("Unsubscribe from one of these roles."),
					choiceTuples,
				),
			)
			.toJSON(),
		exec: async (interaction) => {
			if (!(interaction.member instanceof GuildMember)) {
				return `This command can only be used in a server.`;
			}

			const subcommand = interaction.options.getSubcommand(true);
			const name = interaction.options.getString("name", true);
			const roleId = map[name];

			if (!roleId) {
				return `That role name is no longer configured. Ask a moderator to refresh the bot's configuration.`;
			}

			if (subcommand === "add") {
				if (interaction.member.roles.cache.has(roleId)) {
					return `You already have that role.`;
				}

				try {
					await interaction.member.roles.add(roleId);
				} catch (err) {
					log.error({ err, roleId }, "Failed to add named self-assign Discord role.");

					return discordNamedRoleFailureMessage(err, "grant");
				}

				return `Added subscription **${name}**.`;
			}

			if (subcommand === "remove") {
				if (!interaction.member.roles.cache.has(roleId)) {
					return `You do not have that role.`;
				}

				try {
					await interaction.member.roles.remove(roleId);
				} catch (err) {
					log.error({ err, roleId }, "Failed to remove named self-assign Discord role.");

					return discordNamedRoleFailureMessage(err, "remove");
				}

				return `Removed subscription **${name}**.`;
			}

			return `Unsupported subcommand.`;
		},
	};

	return command;
}

function discordNamedRoleFailureMessage(err: unknown, verb: "grant" | "remove"): string {
	const snippet =
		err &&
		typeof err === "object" &&
		"message" in err &&
		typeof (err as { message: unknown }).message === "string"
			? (err as { message: string }).message
			: String(err);

	return `Discord could not ${verb} that role (${snippet}). If this keeps failing, ensure the bot's role sits above those roles and has Manage Roles.`;
}
