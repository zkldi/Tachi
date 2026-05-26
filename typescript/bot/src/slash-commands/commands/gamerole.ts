import type { GameGroup } from "tachi-common";

import { Env } from "#config";
import { log } from "#utils/log";
import { SlashCommandBuilder, type SlashCommandSubcommandBuilder } from "@discordjs/builders";
import { GuildMember } from "discord.js";

import type { SlashCommand } from "../types";

import { IsGameGroupKey } from "../../utils/predicates";
import { SLASH_STRING_CHOICE_LIMIT, sortedSlashChoiceKeys } from "../slash-choice-limit";

/** Discord allows at most 25 string choices per option. Kept as an alias for tests and call sites that already name it this way. */
export const SELF_ASSIGN_ROLE_CHOICE_LIMIT = SLASH_STRING_CHOICE_LIMIT;

/**
 * Stable sorted GameGroup keys capped for slash choices + list of omitted keys after the cutoff.
 *
 * Exported for tests.
 */
export function selfAssignableSlashChoiceKeys(
	map: Partial<Record<GameGroup, string>>,
	limit = SELF_ASSIGN_ROLE_CHOICE_LIMIT,
): {
	keysIncluded: readonly GameGroup[];
	keysOmitted: readonly GameGroup[];
} {
	const { keysIncluded, keysOmitted } = sortedSlashChoiceKeys(Object.keys(map), limit);

	return {
		keysIncluded: keysIncluded as GameGroup[],
		keysOmitted: keysOmitted as GameGroup[],
	};
}

function attachRoleChoiceOption(sub: SlashCommandSubcommandBuilder, choices: [string, string][]) {
	return sub.addStringOption((opt) =>
		opt
			.setName("role")
			.setRequired(true)
			.setDescription("Which game group ping role.")
			.addChoices(choices),
	);
}

/** Returns slash command `/gamerole`, or null if there is nothing to expose. */
export function getGameroleSlashCommand(): SlashCommand | null {
	const map = Env.DISCORD_GAME_ROLES;
	if (Object.keys(map).length === 0) {
		return null;
	}

	const { keysIncluded, keysOmitted } = selfAssignableSlashChoiceKeys(map);
	if (keysOmitted.length > 0) {
		log.warn(
			{
				total: keysIncluded.length + keysOmitted.length,
				limit: SLASH_STRING_CHOICE_LIMIT,
				ignoredKeys: [...keysOmitted],
			},
			`DISCORD_GAME_ROLES exposes more GameGroups than Discord's slash choice limit; only the first ${SLASH_STRING_CHOICE_LIMIT} (alphabetical) appear in \`/gamerole\`.`,
		);
	}

	const choiceTuples: [string, string][] = keysIncluded.map((k) => [k, k]);

	const command: SlashCommand = {
		info: new SlashCommandBuilder()
			.setName("gamerole")
			.setDescription("Add or remove self-assignable game group Discord roles.")
			.addSubcommand((sub) =>
				attachRoleChoiceOption(
					sub
						.setName("add")
						.setDescription("Grant yourself one of these game group roles."),
					choiceTuples,
				),
			)
			.addSubcommand((sub) =>
				attachRoleChoiceOption(
					sub
						.setName("remove")
						.setDescription("Remove one of these game group roles from yourself."),
					choiceTuples,
				),
			)
			.toJSON(),
		exec: async (interaction) => {
			if (!(interaction.member instanceof GuildMember)) {
				return `This command can only be used in a server.`;
			}

			const subcommand = interaction.options.getSubcommand(true);
			const choiceKey = interaction.options.getString("role", true);

			if (!IsGameGroupKey(choiceKey)) {
				return `That selection is not a configured game group.`;
			}

			const gameGroup = choiceKey;
			const roleId = map[gameGroup];

			if (!roleId) {
				return `That game group role is no longer configured. Ask a moderator to refresh the bot's configuration.`;
			}

			if (subcommand === "add") {
				if (interaction.member.roles.cache.has(roleId)) {
					return `You already have that role.`;
				}

				try {
					await interaction.member.roles.add(roleId);
				} catch (err) {
					log.error({ err, roleId }, "Failed to add self-assign Discord role.");

					return discordRoleOpFailureMessage(err, "grant");
				}

				return `Added role for **${gameGroup}**.`;
			}

			if (subcommand === "remove") {
				if (!interaction.member.roles.cache.has(roleId)) {
					return `You do not have that role.`;
				}

				try {
					await interaction.member.roles.remove(roleId);
				} catch (err) {
					log.error({ err, roleId }, "Failed to remove self-assign Discord role.");

					return discordRoleOpFailureMessage(err, "remove");
				}

				return `Removed role for **${gameGroup}**.`;
			}

			return `Unsupported subcommand.`;
		},
	};

	return command;
}

function discordRoleOpFailureMessage(err: unknown, verb: "grant" | "remove"): string {
	const snippet =
		err &&
		typeof err === "object" &&
		"message" in err &&
		typeof (err as { message: unknown }).message === "string"
			? (err as { message: string }).message
			: String(err);

	return `Discord could not ${verb} that role (${snippet}). If this keeps failing, ensure the bot's role sits above those roles and has Manage Roles.`;
}
