import type { Request } from "express";

import { SYMBOL_TACHI_DATA } from "#lib/constants/tachi";
import deepmerge from "deepmerge";

import type { TachiRequestData } from "./types";

export function REQ_AssignToReqTachiData(req: Request, data: Partial<TachiRequestData>) {
	if (!req[SYMBOL_TACHI_DATA]) {
		req[SYMBOL_TACHI_DATA] = data;
	} else {
		req[SYMBOL_TACHI_DATA] = deepmerge(req[SYMBOL_TACHI_DATA]!, data, {
			// don't merge arrays, replace them with the new array.

			arrayMerge: (_a, b) => b,
		});
	}
}

export function REQ_GetTachiData<T extends keyof TachiRequestData>(
	req: Request,
	key: T,
): Exclude<TachiRequestData[T], undefined> {
	if (!req[SYMBOL_TACHI_DATA]) {
		throw new Error(
			`SYMBOL_TACHI_DATA was not set on a request, yet ${key} was attempted to be retrieved from it?`,
		);
	}

	const value = req[SYMBOL_TACHI_DATA][key];

	if (value === undefined) {
		throw new Error(
			`${key} was attempted to be retrieved from SYMBOL_TACHI_DATA, but was not defined.`,
		);
	}

	// Safe assertion due to value === undefined check above.
	return value as unknown as Exclude<TachiRequestData[T], undefined>;
}

export function REQ_GetUser(req: Request) {
	const user = REQ_GetTachiData(req, "requestedUser");

	return user;
}

export function REQ_GetUserGame(req: Request) {
	const user = REQ_GetTachiData(req, "requestedUser");
	const game = REQ_GetTachiData(req, "game");

	return { user, game };
}

export function REQ_GetGame(req: Request) {
	const game = REQ_GetTachiData(req, "game");

	return game;
}

export function REQ_GetGameGroup(req: Request) {
	const gameGroup = REQ_GetTachiData(req, "gameGroup");

	return gameGroup;
}
