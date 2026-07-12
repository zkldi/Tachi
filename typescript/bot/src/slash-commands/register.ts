import type { Client } from "discord.js";

import { log } from "#utils/log";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";

import { Env } from "../config";
import { SLASH_COMMANDS } from "./commands";

const rest = new REST({
	version: "9",
}).setToken(Env.DISCORD_TOKEN);

/**
 * Register our slash commands. If in prod, these
 * @param client
 */
export async function RegisterSlashCommands(client: Client): Promise<void> {
	try {
		const commandsArray = [...SLASH_COMMANDS.values()];

		// always unregister guild slash commands, just in case.
		log.info(`Unregistering guild slash commands.`);

		await UnregisterAllCommands(client);

		if (Env.NODE_ENV === "production") {
			log.info(`Updating global commands.`);

			await rest.put(Routes.applicationCommands(client.application!.id), {
				body: commandsArray.map((command) => command.info),
			});
		} else {
			log.info("Registering guild slash commands.");

			await rest.put(
				Routes.applicationGuildCommands(client.application!.id, Env.DISCORD_SERVER_ID),
				{
					body: commandsArray.map((command) => command.info),
				},
			);
		}

		log.info("Successfully registered guild slash commands.");
	} catch (err) {
		log.error({ err }, "Failed to register guild slash commands.");
		throw err;
	}
}

/**
 * Unregister all the commmands we have.
 */
async function UnregisterAllCommands(client: Client): Promise<void> {
	try {
		log.info("Tidying old guild slash commands.");
		const guilds = client.guilds.cache;

		// discord.js doesn't use arrays because those aren't cool anymore
		// so we have to discard the left side of this.
		// They use collections, which inherit from ES6's Map. Ah well.

		const promises = [];

		for (const [, guild] of guilds) {
			promises.push(guild.commands.set([]));
		}

		await client.application!.commands.set([]);

		// parallelise waiting for these to be deleted.
		await Promise.all(promises);

		log.info(`Successfully tidied ${promises.length} old guild slash commands.`);
	} catch (err) {
		log.error({ err }, "Failed to tidy old guild slash commands.");

		throw err;
	}
}
