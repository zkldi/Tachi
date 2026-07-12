import {
	type AnyProfileRatingAlg,
	type AnyScoreRatingAlg,
	type AnySessionRatingAlg,
	GetGameConfig,
	type V3Game,
} from "tachi-common";

import { IsString } from "./misc";

const isIntegerRegex = /^-?\d+$/u;

export function ParseStrPositiveInt(val: unknown) {
	if (!IsString(val)) {
		return null;
	}

	const isInt = isIntegerRegex.test(val);

	if (!isInt) {
		return null;
	}

	const v = Number(val);

	if (!Number.isSafeInteger(v) || v < 0) {
		return null;
	}

	return v;
}

export function ParseStrPositiveNonZeroInt(val: unknown) {
	if (!IsString(val)) {
		return null;
	}

	const isInt = isIntegerRegex.test(val);

	if (!isInt) {
		return null;
	}

	const v = Number(val);

	if (!Number.isSafeInteger(v) || v <= 0) {
		return null;
	}

	return v;
}

export function CheckStrProfileAlg(game: V3Game, strVal: string) {
	const gameConfig = GetGameConfig(game);

	// @hack
	if (!Object.keys(gameConfig.profileRatingAlgs).includes(strVal as AnyProfileRatingAlg)) {
		return null;
	}

	return strVal as AnyProfileRatingAlg;
}

export function CheckStrScoreAlg(game: V3Game, strVal: string) {
	const gameConfig = GetGameConfig(game);

	// @hack
	if (!Object.keys(gameConfig.scoreRatingAlgs).includes(strVal as AnyScoreRatingAlg)) {
		return null;
	}

	return strVal as AnyScoreRatingAlg;
}

export function CheckStrSessionAlg(game: V3Game, strVal: string) {
	const gameConfig = GetGameConfig(game);

	// @hack
	if (!Object.keys(gameConfig.sessionRatingAlgs).includes(strVal as AnySessionRatingAlg)) {
		return null;
	}

	return strVal as AnySessionRatingAlg;
}
