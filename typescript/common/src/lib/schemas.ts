// Schemas for some objects in tachi. These are exported in a record that maps
// their name in the database to the object they schemaify.
// The schemas themselves are wrapped in functions that throw on error.

import {
	p,
	type PrudenceSchema,
	type ValidationFunctionParentOptionsKeychain,
	type ValidSchemaValue,
} from "prudence";

import type { GameGroup, LEGACY_Playtypes, V3Game } from "../types/game-config";
import type { ConfScoreMetric } from "../types/metrics";

import {
	allSupportedGameGroups,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	GetScoreMetrics,
	LEGACY_GameGroupPTToGame,
	LEGACY_GameToPlaytypeFn,
	LEGACY_GetGamePTConfig,
} from "../config/config";
import { PrudenceZodShim } from "../utils/util";

export const optNull = (v: ValidSchemaValue): ValidationFunctionParentOptionsKeychain =>
	p.optional(p.nullable(v));

export const optNullFluffStrField = optNull(p.isBoundedString(3, 140));

/**
 * Wrap a prudence schema in a callable function that takes an unknown item and attempts
 * to validate it.
 */
function prSchemaFnWrap(schema: PrudenceSchema) {
	return (s: unknown): true => {
		const err = p(s, schema);

		if (err) {
			throw err;
		}

		return true;
	};
}

const extractGame = (self: unknown) => {
	if (typeof self !== "object" || !self) {
		throw new Error("Expected an object.");
	}

	const s = self as Record<string, unknown>;

	if (typeof s.game !== "string") {
		throw new Error(`Expected a string where self.game is. Got ${s.game}`);
	}

	if (typeof s.playtype !== "string") {
		throw new Error(`Expected a string where self.playtype is. Got ${s.playtype}`);
	}

	if (!IsValidGameGroup(s.game)) {
		throw new Error(`Expected valid game -- got ${s.game}.`);
	}

	if (!IsValidPlaytype(s.game, s.playtype)) {
		throw new Error(`Expected valid playtype -- got ${s.playtype}.`);
	}

	return {
		v3Game: LEGACY_GameGroupPTToGame(s.game, s.playtype),
		gameGroup: s.game,
		playtype: s.playtype,
	};
};

function IsValidPlaytype(game: GameGroup, str: string): str is LEGACY_Playtypes[GameGroup] {
	return GetGameGroupConfig(game).playtypes.includes(str as LEGACY_Playtypes[GameGroup]);
}

function IsValidGameGroup(str: string): str is GameGroup {
	return allSupportedGameGroups.includes(str as GameGroup);
}

const games = allSupportedGameGroups;

const isValidPlaytype = (self: unknown, parent: Record<string, unknown>) => {
	if (typeof parent.game !== "string" || !IsValidGameGroup(parent.game)) {
		throw new Error(`Invalid Schema, need game to base IsValidPlaytype off of.`);
	}

	if (typeof self !== "string") {
		return "Expected a string.";
	}

	if (!IsValidPlaytype(parent.game, self)) {
		return `Expected a valid playtype for ${parent.game}`;
	}

	return true;
};

export const PR_GOAL_SCHEMA = (self: unknown) => {
	const { gameGroup: game, playtype } = extractGame(self);

	return prSchemaFnWrap({
		game: p.isIn(games),
		playtype: isValidPlaytype,
		name: "string",
		goalID: "string",
		criteria: p.or(
			{
				mode: p.is("single"),
				key: (self) => {
					const gameConfig = LEGACY_GetGamePTConfig(game, playtype);
					const metrics = GetScoreMetrics(gameConfig);

					return p.isIn(metrics)(self);
				},
				value: "number",
			},
			{
				mode: p.isIn("absolute", "proportion"),
				countNum: p.isPositive,
				key: (self) => {
					const gameConfig = LEGACY_GetGamePTConfig(game, playtype);
					const metrics = GetScoreMetrics(gameConfig);

					return p.isIn(metrics)(self);
				},
				value: "number",
			},
		),
		charts: p.or(
			{
				type: p.is("folder"),
				data: "string",
			},
			{
				type: p.is("multi"),
				data: ["string"],
			},
			{
				type: p.is("single"),
				data: "string",
			},
		),
	})(self);
};

// Returns true on success, throws on failure.
export type SchemaValidatorFunction = (self: unknown) => true;

const PR_BATCH_MANUAL_SCORE = (game: V3Game): PrudenceSchema => {
	const gameConfig = GetGameConfig(game);

	return {
		...PR_METRICS(gameConfig.providedMetrics),

		matchType: p.isIn(
			"songTitle",
			"tachiSongID",
			"bmsChartHash",
			"gcmInGameIDSpecialChart",
			"itgChartHash",
			"sdvxInGameID",
			"inGameID",
			"inGameStrID",
			"uscChartHash",
			"popnChartHash",
			"ddrSongHash",
		),
		identifier: "string",
		comment: optNull(p.isBoundedString(3, 240)),
		difficulty: "*?string",
		artist: "*?string",

		// this is checked in converting instead
		// the lowest acceptable time is september 9th 2001 - this check saves people who dont
		// read any documentation and would otherwise submit garbage.
		timeAchieved: optNull(
			(self) =>
				(typeof self === "number" && self > 1_000_000_000_000) ||
				self === 0 ||
				"Expected a number greater than 1 Trillion - did you pass unix seconds instead of milliseconds?",
		),
		judgements: optNull((self) => {
			if (typeof self !== "object" || self === null) {
				return "Not a valid object.";
			}

			for (const [key, v] of Object.entries(self)) {
				if (!gameConfig.orderedJudgements.includes(key)) {
					return `Invalid Key ${key}. Expected any of ${gameConfig.orderedJudgements.join(
						", ",
					)}`;
				}

				if ((!Number.isSafeInteger(v) || v < 0) && v !== null) {
					return `Key ${key} had an invalid value of ${v} [type: ${typeof v}]`;
				}
			}

			return true;
		}),
		optional: optNull(PR_METRICS(gameConfig.optionalMetrics, true)),
		hitMeta: optNull(PR_METRICS(gameConfig.optionalMetrics, true)),
		scoreMeta: optNull(PrudenceZodShim(gameConfig.scoreMeta)),
	};
};

function PR_METRIC(metric: ConfScoreMetric): ValidSchemaValue {
	switch (metric.type) {
		case "DECIMAL":
			return "number";

		case "INTEGER":
			return p.isInteger;

		case "GRAPH":
			return ["number"];

		case "ENUM":
			return p.isIn(metric.values);

		case "NULLABLE_GRAPH":
			return ["?number"];
	}
}

function PR_METRICS(metrics: Record<string, ConfScoreMetric>, shouldAllBeOptNull?: boolean) {
	const schema: PrudenceSchema = {};

	for (const [key, value] of Object.entries(metrics)) {
		let prValidator = PR_METRIC(value);

		if ("validate" in value) {
			switch (value.type) {
				case "DECIMAL":
				case "INTEGER": {
					prValidator = p.and(
						prValidator,
						(self) => typeof self === "number" && value.validate(self),
					);
					break;
				}

				case "GRAPH": {
					prValidator = p.and(prValidator, [
						(self) => typeof self === "number" && value.validate(self),
					]);
					break;
				}

				case "NULLABLE_GRAPH":
					prValidator = p.and(prValidator, [
						(self) =>
							self === null || (typeof self === "number" && value.validate(self)),
					]);
			}
		}

		if (shouldAllBeOptNull === true) {
			schema[key] = optNull(prValidator);
		} else {
			schema[key] = prValidator;
		}
	}

	return schema;
}

const PR_BATCH_MANUAL_CLASSES = (game: V3Game): PrudenceSchema => {
	const config = GetGameConfig(game);

	const schema: PrudenceSchema = {};

	// for all classes this game supports
	// if `canBeBatchManualSubmitted` is true, allow it to be batchManualSubmitted.
	for (const [s, v] of Object.entries(config.classes)) {
		if (v.type === "PROVIDED") {
			schema[s] = optNull(p.isIn(v.values.map((e) => e.id)));
		}
	}

	return schema;
};

/**
 * Batch-manual meta supports either legacy `{ game: GameGroup, playtype }` or v3 `{ game: V3Game }`
 * without `playtype` (see batch-manual parser on the server).
 */
const PR_BATCH_MANUAL_META = (game: V3Game) =>
	p.or(
		{
			service: p.isBoundedString(3, 60),
			game: p.is(game),
			version: "*?string",
		},
		{
			service: p.isBoundedString(3, 60),
			game: p.is(GameToGameGroup(game)),
			playtype: p.is(LEGACY_GameToPlaytypeFn(game)),
			version: "*?string",
		},
	);

export const PR_BATCH_MANUAL = (game: V3Game): PrudenceSchema => ({
	meta: PR_BATCH_MANUAL_META(game),
	scores: [PR_BATCH_MANUAL_SCORE(game)],
	classes: optNull(PR_BATCH_MANUAL_CLASSES(game)),
});

export const PR_RESOLVER: PrudenceSchema = {
	matchType: p.isIn(
		"songTitle",
		"tachiSongID",
		"bmsChartHash",
		"gcmInGameIDSpecialChart",
		"itgChartHash",
		"sdvxInGameID",
		"inGameID",
		"inGameStrID",
		"uscChartHash",
		"popnChartHash",
		"ddrSongHash",
	),
	identifier: "string",
	comment: optNull(p.isBoundedString(3, 240)),

	// extra disambiguators
	difficulty: "*?string",
	artist: "*?string",
	version: "*?string",
};
