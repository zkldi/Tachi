import { dmf } from "#test-utils/misc";
import { ALL_GAMES, GetGameConfig, type V3Game } from "tachi-common";
import { type ConfScoreMetric } from "tachi-common/types/metrics";

import type { DryScore } from "../common/types";

import { CreateScoreID } from "./score-id";

/** Stable inputs shared by every snapshot case. */
export const SCORE_ID_CANONICAL_USER_ID = 1;
export const SCORE_ID_ALT_USER_ID = 424_242;
export const SCORE_ID_CANONICAL_CHART_ID = "c2311194e3897ddb5745b1760d2c0141f933e683";
export const SCORE_ID_ALT_CHART_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function isEnumMetric(
	conf: ConfScoreMetric,
): conf is { type: "ENUM"; values: Array<string> } & ConfScoreMetric {
	return conf.type === "ENUM";
}

function baselineProvidedValue(conf: ConfScoreMetric): number | string {
	switch (conf.type) {
		case "INTEGER":
			return 500_000;
		case "DECIMAL":
			return 97.53;
		case "ENUM": {
			if (isEnumMetric(conf) && conf.minimumRelevantValue) {
				return conf.minimumRelevantValue;
			}

			return isEnumMetric(conf) ? conf.values[Math.min(2, conf.values.length - 1)]! : "CLEAR";
		}
		default:
			throw new Error(`Unsupported provided metric type: ${(conf as ConfScoreMetric).type}`);
	}
}

function alternateProvidedValue(conf: ConfScoreMetric, baseline: number | string): number | string {
	switch (conf.type) {
		case "INTEGER":
			return baseline === 500_000 ? 123_456 : 500_000;
		case "DECIMAL":
			return baseline === 97.53 ? 88.88 : 97.53;
		case "ENUM": {
			if (!isEnumMetric(conf)) {
				throw new Error("Expected enum metric");
			}

			const idx = conf.values.indexOf(baseline as string);

			return conf.values[(idx + 1) % conf.values.length]!;
		}
		default:
			throw new Error(`Unsupported provided metric type: ${(conf as ConfScoreMetric).type}`);
	}
}

function baselineOptionalPartOfScoreIdValue(conf: ConfScoreMetric): number | string {
	switch (conf.type) {
		case "INTEGER":
			return 777;
		case "DECIMAL":
			return 12.34;
		case "ENUM": {
			if (isEnumMetric(conf) && conf.minimumRelevantValue) {
				return conf.minimumRelevantValue;
			}

			return isEnumMetric(conf) ? conf.values[0]! : "0";
		}
		default:
			throw new Error(
				`Unsupported partOfScoreID optional metric type: ${(conf as ConfScoreMetric).type}`,
			);
	}
}

/**
 * Builds a minimal DryScore with every provided metric and every
 * partOfScoreID optional metric populated with stable values.
 */
export function buildCanonicalDryScore(game: V3Game): DryScore {
	const gameConfig = GetGameConfig(game);

	const scoreData: Record<string, unknown> = {
		judgements: {},
		optional: {},
	};

	for (const [metric, conf] of Object.entries(gameConfig.providedMetrics)) {
		scoreData[metric] = baselineProvidedValue(conf);
	}

	for (const [metric, conf] of Object.entries(gameConfig.optionalMetrics)) {
		if (conf.partOfScoreID) {
			(scoreData.optional as Record<string, unknown>)[metric] =
				baselineOptionalPartOfScoreIdValue(conf);
		}
	}

	return {
		service: "score-id-fixture",
		game,
		scoreData: scoreData as DryScore["scoreData"],
		scoreMeta: {},
		timeAchieved: null,
		comment: null,
		importType: "file/batch-manual",
	};
}

/**
 * Returns every score-id variant we care about locking for a game:
 * baseline identity inputs, user/chart permutations, each provided metric,
 * and each partOfScoreID optional (set vs null).
 */
export function collectScoreIdVariants(game: V3Game): Record<string, string> {
	const dryScore = buildCanonicalDryScore(game);
	const gameConfig = GetGameConfig(game);

	const variants: Record<string, string> = {
		baseline: CreateScoreID(
			game,
			SCORE_ID_CANONICAL_USER_ID,
			dryScore,
			SCORE_ID_CANONICAL_CHART_ID,
		),
		userID: CreateScoreID(game, SCORE_ID_ALT_USER_ID, dryScore, SCORE_ID_CANONICAL_CHART_ID),
		chartID: CreateScoreID(game, SCORE_ID_CANONICAL_USER_ID, dryScore, SCORE_ID_ALT_CHART_ID),
	};

	for (const [metric, conf] of Object.entries(gameConfig.providedMetrics)) {
		const baseline = baselineProvidedValue(conf);
		const alternate = alternateProvidedValue(conf, baseline);

		variants[`provided.${metric}`] = CreateScoreID(
			game,
			SCORE_ID_CANONICAL_USER_ID,
			dmf(dryScore, {
				scoreData: {
					[metric]: alternate,
				},
			}),
			SCORE_ID_CANONICAL_CHART_ID,
		);
	}

	for (const [metric, conf] of Object.entries(gameConfig.optionalMetrics)) {
		if (!conf.partOfScoreID) {
			continue;
		}

		const setValue = baselineOptionalPartOfScoreIdValue(conf);

		variants[`optional.${metric}.set`] = CreateScoreID(
			game,
			SCORE_ID_CANONICAL_USER_ID,
			dmf(dryScore, {
				scoreData: {
					optional: {
						[metric]: setValue,
					},
				},
			}),
			SCORE_ID_CANONICAL_CHART_ID,
		);

		variants[`optional.${metric}.null`] = CreateScoreID(
			game,
			SCORE_ID_CANONICAL_USER_ID,
			dmf(dryScore, {
				scoreData: {
					optional: {
						[metric]: null,
					},
				},
			}),
			SCORE_ID_CANONICAL_CHART_ID,
		);

		variants[`optional.${metric}.unset`] = CreateScoreID(
			game,
			SCORE_ID_CANONICAL_USER_ID,
			dmf(dryScore, {
				scoreData: {
					optional: {
						[metric]: undefined,
					},
				},
			}),
			SCORE_ID_CANONICAL_CHART_ID,
		);
	}

	// Non-partOfScoreID optionals must not affect the hash.
	const firstNonScoreIdOptional = Object.entries(gameConfig.optionalMetrics).find(
		([, conf]) => !conf.partOfScoreID,
	);

	if (firstNonScoreIdOptional) {
		const [metric] = firstNonScoreIdOptional;

		variants[`optional.${metric}.ignored`] = CreateScoreID(
			game,
			SCORE_ID_CANONICAL_USER_ID,
			dmf(dryScore, {
				scoreData: {
					optional: {
						[metric]: 99_999,
					},
				},
			}),
			SCORE_ID_CANONICAL_CHART_ID,
		);
	}

	return variants;
}

export const SCORE_ID_SNAPSHOT_GAMES = ALL_GAMES;
