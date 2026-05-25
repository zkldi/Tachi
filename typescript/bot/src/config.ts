import type { GameGroup, integer, TachiServerCoreConfig, V3Game } from "tachi-common";

import { log } from "bliss/log";
import { config } from "dotenv";
import { p } from "prudence";

import { IsRecord } from "./utils/predicates";
import { FormatPrError } from "./utils/prudence";

// Initialise .env.
config();

export const Env = ParseEnvVars();

function ParseGameChannels(raw: string | undefined): Partial<Record<GameGroup, string>> {
	if (!raw) {
		return {};
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`DISCORD_GAME_CHANNELS is not valid JSON: ${err}. Got ${raw}`);
	}

	if (!IsRecord(parsed)) {
		throw new Error(
			"DISCORD_GAME_CHANNELS must be a JSON object mapping game names to channel IDs.",
		);
	}

	for (const [key, value] of Object.entries(parsed)) {
		if (typeof value !== "string") {
			throw new Error(
				`DISCORD_GAME_CHANNELS: invalid value for key ${key}. Expected a string channel ID.`,
			);
		}
	}

	return parsed as Partial<Record<GameGroup, string>>;
}

export interface ProcessEnvironment {
	TACHI_SERVER_LOCATION: string;
	HTTP_SERVER_URL: string;
	OAUTH_CLIENT_ID: string;
	OAUTH_CLIENT_SECRET: string;
	DISCORD_TOKEN: string;
	DISCORD_SERVER_ID: string;
	DISCORD_GAME_CHANNELS: Partial<Record<V3Game, string>>;
	DISCORD_ADMIN_USERS: string[];
	DISCORD_APPROVED_ROLE: string | undefined;
	DISCORD_LIMBO_CHANNEL: string | undefined;
	NODE_ENV: "dev" | "production" | "staging" | "test";
	POSTGRES_URL: string;
	PORT: integer;
}

function ParseEnvVars() {
	const err = p(
		process.env,
		{
			NODE_ENV: p.isIn("production", "dev", "staging", "test"),

			// mei implicitly reads this.
			LOG_LEVEL: p.optional(
				p.isIn("debug", "verbose", "info", "warn", "error", "severe", "crit"),
			),
			POSTGRES_URL: "string",
			PORT: (self) =>
				p.isPositiveInteger(Number(self)) === true ||
				"Should be a string representing a whole integer port.",

			TACHI_SERVER_LOCATION: "string",
			HTTP_SERVER_URL: "string",
			OAUTH_CLIENT_ID: "string",
			OAUTH_CLIENT_SECRET: "string",
			DISCORD_TOKEN: "string",
			DISCORD_SERVER_ID: "string",
			DISCORD_GAME_CHANNELS: "*string",
			DISCORD_ADMIN_USERS: "*string",
			DISCORD_APPROVED_ROLE: "*string",
			DISCORD_LIMBO_CHANNEL: "*string",
		},
		{},
		{ allowExcessKeys: true },
	);

	if (err) {
		log.error(FormatPrError(err, "Invalid environment. Cannot safely boot."));

		throw err;
	}

	const Env: ProcessEnvironment = {
		NODE_ENV: process.env.NODE_ENV as "dev" | "production" | "staging" | "test",
		POSTGRES_URL: process.env.POSTGRES_URL!,
		PORT: Number(process.env.PORT),
		TACHI_SERVER_LOCATION: process.env.TACHI_SERVER_LOCATION!,
		HTTP_SERVER_URL: process.env.HTTP_SERVER_URL!,
		OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID!,
		OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET!,
		DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
		DISCORD_SERVER_ID: process.env.DISCORD_SERVER_ID!,
		DISCORD_GAME_CHANNELS: ParseGameChannels(process.env.DISCORD_GAME_CHANNELS),
		DISCORD_ADMIN_USERS: process.env.DISCORD_ADMIN_USERS?.split(",") ?? [],
		DISCORD_APPROVED_ROLE: process.env.DISCORD_APPROVED_ROLE,
		DISCORD_LIMBO_CHANNEL: process.env.DISCORD_LIMBO_CHANNEL,
	};

	return Env;
}

// The Tachi Server exports all of the information about it. This saves us having to
// sync more metadata across instances.
async function GetServerConfig() {
	// Yes, I know synchronous fetch is disgusting. However, we can't do anything until
	// this fetch is complete, and it saves us having to do a singleton pattern or worse.
	// This *should* be solved with top-level-await, but good luck actually getting
	// typescript to output the right stuff here.

	const url = `${Env.TACHI_SERVER_LOCATION}/api/v1/config`;
	const httpRes = await fetch(url);
	const text = await httpRes.text();

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		const preview = text.length > 500 ? `${text.slice(0, 500)}…` : text;
		log.error(
			`Expected JSON from ${url} (HTTP ${httpRes.status} ${httpRes.statusText}), but response was not valid JSON. Body preview:\n${preview}`,
		);
		process.exit(1);
	}

	if (!parsed || typeof parsed !== "object" || !("success" in parsed)) {
		log.error(
			`Server config response from ${url} was JSON but missing a success field. Can't run.`,
		);
		process.exit(1);
	}

	const res = parsed as { body?: unknown; success: boolean };

	if (!res.success) {
		log.error(`Failed to fetch server info from ${Env.TACHI_SERVER_LOCATION}. Can't run.`);
		process.exit(1);
	}

	return res.body as TachiServerCoreConfig;
}

export const ServerConfig = await GetServerConfig();

// General warnings for config misuse.
// This warns people if their parent server supports games that they aren't acknowledging.
for (const game of ServerConfig.GAME_GROUPS) {
	if (!Object.prototype.hasOwnProperty.call(Env.DISCORD_GAME_CHANNELS, game)) {
		log.warn(
			`${ServerConfig.NAME} declares support for ${game}, but no channel is mapped to it. Set DISCORD_GAME_CHANNELS to include it.`,
		);
	}
}
