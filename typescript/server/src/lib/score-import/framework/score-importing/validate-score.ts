import type { ConfScoreMetric } from "tachi-common/types/metrics";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { RunValidators } from "#game-implementations/games/_common";
import { ONE_HOUR } from "#lib/constants/time";
import { type ChartDocument, GetGameConfig, type ScoreDocument, type V3Game } from "tachi-common";

import { InvalidScoreFailure } from "../common/converter-failures";

/**
 * Checks if a score passes all of its validation checks.
 *
 * @returns nothing. This will throw an InvalidScoreFailure on error.
 */
export function ValidateScore(score: ScoreDocument, chart: ChartDocument): void {
	const leniency = ONE_HOUR * 24;

	if (score.timeAchieved !== null && score.timeAchieved > Date.now() + leniency) {
		throw new InvalidScoreFailure("Invalid timestamp: score happens in the future.");
	}

	ValidateScoreGameSpecific(score, chart);
}

function ValidateScoreGameSpecific(score: ScoreDocument, chart: ChartDocument): void {
	const game = score.game;
	const gameConfig = GetGameConfig(game);
	const impl = GAME_IMPLEMENTATIONS[game];

	const errs: Array<string> = [];

	ValidateMetrics(
		errs,
		gameConfig.providedMetrics,
		game,
		score,
		chart,
		// @ts-expect-error ughhh
		(s, m) => s.scoreData[m],
	);
	ValidateMetrics(
		errs,
		gameConfig.derivedMetrics,
		game,
		score,
		chart,
		// @ts-expect-error ughhh
		(s, m) => s.scoreData[m],
	);

	ValidateMetrics(
		errs,
		gameConfig.optionalMetrics,
		game,
		score,
		chart,
		// @ts-expect-error ughhh
		(s, m) => s.scoreData.optional[m],
		true,
	);

	const moreErrors = RunValidators(impl.scoreValidators as any, score, chart);

	if (moreErrors) {
		errs.push(...moreErrors);
	}

	if (errs.length > 0) {
		const errorStr = errs.length === 1 ? "error" : "errors";

		throw new InvalidScoreFailure(`Got ${errs.length} ${errorStr} when validating score:
${errs.join("\n")}`);
	}
}

function ValidateMetrics(
	errs: Array<string>,
	metrics: Record<string, ConfScoreMetric>,
	game: V3Game,
	score: ScoreDocument,
	chart: ChartDocument,
	valueGetter: (s: ScoreDocument, metric: string) => any,
	optional?: boolean,
) {
	const impl = GAME_IMPLEMENTATIONS[game];

	for (const [metric, conf] of Object.entries(metrics)) {
		const scoreVal: any = valueGetter(score, metric);

		if (optional && (scoreVal === undefined || scoreVal === null)) {
			continue;
		}

		switch (conf.type) {
			case "ENUM": {
				if (!conf.values.includes(scoreVal)) {
					errs.push(
						`Invalid value for ${metric}, got ${scoreVal}, but expected any of ${conf.values.join(
							", ",
						)}.`,
					);
				}

				break;
			}

			case "INTEGER":
			case "DECIMAL": {
				if (conf.type === "INTEGER" && !Number.isSafeInteger(scoreVal)) {
					errs.push(
						`Invalid value for ${metric}, got ${scoreVal}, but expected an integer.`,
					);
				} else if (!Number.isFinite(scoreVal)) {
					errs.push(
						`Invalid value for ${metric}, got ${scoreVal}, but expected a finite number.`,
					);
				}

				let err: string | true;

				if (conf.chartDependentMax) {
					// @ts-expect-error hack, this is fine. don't worry.
					err = impl.chartSpecificValidators[metric](scoreVal, chart);
				} else {
					err = conf.validate(scoreVal);
				}

				if (typeof err === "string") {
					errs.push(`Invalid value for ${metric}, ${err} Got ${scoreVal}.`);
				}

				break;
			}

			case "GRAPH":
			case "NULLABLE_GRAPH": {
				if (!Array.isArray(scoreVal)) {
					errs.push(`Invalid value for metric ${metric}, expected an array.`);
					break;
				}

				for (const v of scoreVal) {
					if (conf.type === "NULLABLE_GRAPH" && v === null) {
						continue;
					}

					const err = conf.validate(v);

					if (typeof err === "string") {
						errs.push(`Invalid value for metric ${metric}, ${err}, got ${v}.`);
					}
				}

				if (conf.size) {
					const err = conf.size(scoreVal.length);

					if (typeof err === "string") {
						errs.push(
							`Invalid size of metric ${metric}, ${err}, got an array of size ${scoreVal.length}.`,
						);
					}
				}
			}
		}
	}
}
