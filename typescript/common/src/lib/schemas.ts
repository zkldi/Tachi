// Last bastion of prudence code - the validator for batch manual input.

import {
	p,
	type PrudenceSchema,
	type ValidationFunctionParentOptionsKeychain,
	type ValidSchemaValue,
} from "prudence";

import type { V3Game } from "../types/game-config";
import type { ConfScoreMetric } from "../types/metrics";

import { GameToGameGroup, GetGameConfig, LEGACY_GameToPlaytypeFn } from "../config/config";
import { PrudenceZodShim } from "../utils/util";

export const optNull = (v: ValidSchemaValue): ValidationFunctionParentOptionsKeychain =>
	p.optional(p.nullable(v));

export const optNullFluffStrField = optNull(p.isBoundedString(3, 140));

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
