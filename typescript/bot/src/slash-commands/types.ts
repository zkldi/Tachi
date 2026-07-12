import type {
	CommandInteraction,
	InteractionReplyOptions,
	MessageEmbed,
	MessagePayload,
} from "discord.js";
import type { APIApplicationCommandOption } from "discord-api-types";

import { type integer } from "tachi-common";

export type Emittable = string | InteractionReplyOptions | MessageEmbed | MessagePayload;

export type RequestingUser = {
	acct: {
		id: integer;
		username: string;
	};
	api_token: string;
	discord_id: string;
};

type Command = (
	interaction: CommandInteraction,
	requestingUser: RequestingUser,
) => Emittable | Promise<Emittable | null>;

export interface SlashCommand {
	info: {
		description: string;
		name: string;
		options: Array<APIApplicationCommandOption>;
	};
	exec: Command;
	/** If true, this command may only be used in the #limbo channel. */
	limboOnly?: boolean;
}
