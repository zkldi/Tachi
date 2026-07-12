import type { Client } from "discord.js";
import type { ClassInfo } from "tachi-common/types/game-config-utils";

import _ from "lodash";
import { DateTime } from "luxon";
import {
	type ChartDocument,
	type Classes,
	GetGameConfig,
	type integer,
	type V3Game,
} from "tachi-common";

import { Env } from "../config";

export function Sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
}

export function Pluralise(int: integer, str: string) {
	if (int === 1) {
		return str;
	}

	return `${str}s`;
}

/**
 * Typesafe asserted version of Object.entries.
 */
export function Entries<K extends string, V>(rec: Partial<Record<K, V>>): Array<[K, V]> {
	return Object.entries(rec) as Array<[K, V]>;
}

export function UppercaseFirst(str: string) {
	if (!str[0]) {
		return "";
	}

	return str[0].toUpperCase() + str.substring(1);
}

export function MillisToSince(ms: number) {
	return DateTime.fromMillis(ms).toRelative();
}

export function FormatDate(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.DATE_HUGE);
}

export function FormatClass(game: V3Game, classSet: Classes[V3Game], classValue: string | null) {
	const gameConfig = GetGameConfig(game);

	if (classValue === null) {
		return "-- nothing --";
	}

	// @ts-expect-error hacky access

	const classInfo: ClassInfo = gameConfig.classes[classSet]?.values?.find?.(
		(k) => k.id === classValue,
	);

	if (!classInfo) {
		throw new Error(`Couldn't find a class at index ${classValue} for ${game} ${classSet}?`);
	}

	return classInfo.display as string;
}

/**
 * Given a game, return the discord channel it's associated with.
 */
export function GetGameChannel(client: Client, game: V3Game) {
	const gameChannelID = Env.DISCORD_GAME_CHANNELS[game];

	if (!gameChannelID) {
		throw new Error(
			`Attempted to get channel for ${game}, but no GAME_CHANNEL was registered.`,
		);
	}

	const channel = client.channels.cache.find((c) => c.id === gameChannelID);

	if (!channel) {
		throw new Error(`No channel with ID ${gameChannelID} is in the cache for this bot.`);
	}

	if (!channel.isText()) {
		throw new Error(
			`Channel ${gameChannelID} (${game}) is not a text channel. Can't send message.`,
		);
	}

	return channel;
}

export function GetLimboChannel(client: Client) {
	const limboCID = Env.DISCORD_LIMBO_CHANNEL;

	if (!limboCID) {
		throw new Error(`Attempted to get channel for #limbo, but none was registered.`);
	}

	const channel = client.channels.cache.find((c) => c.id === limboCID);

	if (!channel) {
		throw new Error(`No channel with ID ${limboCID} is in the cache for this bot.`);
	}

	if (!channel.isText()) {
		throw new Error(`Channel ${limboCID} is not a text channel. Can't send message.`);
	}

	return channel;
}

/**
 * Given a chart and a game, return a link to the site for that chart.
 */
export function CreateChartLink(chart: ChartDocument) {
	return `${Env.TACHI_SERVER_LOCATION}/games/${chart.game}/charts/${chart.chartID}`;
}

export function ConvertInputIntoGenerousRegex(input: string) {
	const inputSafeRegex = _.escapeRegExp(input);

	// for any a-zA-Z input, replace them with a ".?", representing maybe. This
	// is so users can say things like "Re Master" or "Remaster" for "Re:Master".
	// It also generally gives lenience.
	// We match based on what the string starts with case-insensitively.
	// "A" will match "ANOTHER", but not "NORMAL".
	const regex = new RegExp(`^${inputSafeRegex.replace(/[^a-zA-Z]/gu, ".?")}`, "iu");

	return regex;
}
