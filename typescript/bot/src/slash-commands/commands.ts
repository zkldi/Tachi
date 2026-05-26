import type { SlashCommand } from "./types";

import { Env, ServerConfig } from "../config";
import faq from "./commands/faq";
import { getGameroleSlashCommand } from "./commands/gamerole";
import invite from "./commands/invite";
import letmein from "./commands/letmein";
import ping from "./commands/ping";
import { getRoleSlashCommand } from "./commands/role";
import sync from "./commands/sync";
import whois from "./commands/whois";

export const SLASH_COMMANDS: Map<string, SlashCommand> = new Map(
	Object.entries({
		ping,
		faq,
		whois,
	}),
);

const gameroleSlash = getGameroleSlashCommand();
if (gameroleSlash) {
	SLASH_COMMANDS.set("gamerole", gameroleSlash);
}

const roleSlash = getRoleSlashCommand();
if (roleSlash) {
	SLASH_COMMANDS.set("role", roleSlash);
}

if (Env.DISCORD_APPROVED_ROLE) {
	SLASH_COMMANDS.set("letmein", letmein);
}

// kamaitachi or omni specific commands
if (ServerConfig.TYPE !== "boku") {
	SLASH_COMMANDS.set("sync", sync);
}

// bokutachi or omni specific commands
if (ServerConfig.TYPE !== "kamai") {
	SLASH_COMMANDS.set("invite", invite);
}
