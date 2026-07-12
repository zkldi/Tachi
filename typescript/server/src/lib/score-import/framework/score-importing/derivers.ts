import type { KtLogger } from "#lib/log/log";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import {
	type ChartDocument,
	GetGameConfig,
	type integer,
	type MongoDerivedMetrics,
	type OptionalEnumIndexes,
	type ScoreData,
	type ScoreEnumIndexes,
	type V3Game,
} from "tachi-common";

import type { DryScore, DryScoreData } from "../common/types";

import { InternalFailure } from "../common/converter-failures";

/**
 * Given the providedMetrics and chart this score is on, derive the rest of the metrics
 * we want to store.
 */
function DeriveMetrics<TGame extends V3Game>(
	metrics: DryScoreData<TGame>,
	chart: ChartDocument<TGame>,
) {
	return GAME_IMPLEMENTATIONS[chart.game].scoreDeriver(
		metrics as ScoreData<TGame>,
		chart,
	) as MongoDerivedMetrics[TGame];
}

export function CreateEnumIndexes<TGame extends V3Game>(game: TGame, metrics: any, log: KtLogger) {
	const gameConfig = GetGameConfig(game);

	const indexes: Record<string, integer> = {};
	const optionalIndexes: Record<string, integer> = {};

	for (const [key, conf] of [
		...Object.entries(gameConfig.providedMetrics),
		...Object.entries(gameConfig.derivedMetrics),
	]) {
		if (conf.type !== "ENUM") {
			continue;
		}

		const index = conf.values.indexOf(metrics[key]);

		if (index === -1) {
			log.error(
				{ metrics, key, conf },
				`Got an invalid enum value of ${metrics[key]} for ${game} ${key} on DryScore. Can't add indexes?`,
			);

			throw new InternalFailure(
				`Got an invalid enum value of ${metrics[key]} for ${game} ${key} on DryScore. Can't add indexes?`,
			);
		}

		indexes[key] = index;
	}

	for (const [key, conf] of Object.entries(gameConfig.optionalMetrics)) {
		if (conf.type !== "ENUM") {
			continue;
		}

		// skip undefined metrics
		if (!metrics.optional[key]) {
			continue;
		}

		const index = conf.values.indexOf(metrics.optional[key]);

		if (index === -1) {
			log.error(
				{ metrics, key, conf },
				`Got an invalid enum value of ${metrics.optional[key]} for ${game} optional.${key} on DryScore. Can't add indexes?`,
			);

			throw new InternalFailure(
				`Got an invalid enum value of ${metrics.optional[key]} for ${game} optional.${key} on DryScore. Can't add indexes?`,
			);
		}

		optionalIndexes[key] = index;
	}

	return {
		indexes: indexes as ScoreEnumIndexes<TGame>,
		optionalIndexes: optionalIndexes as OptionalEnumIndexes<TGame>,
	};
}

/**
 * Return a full piece of scoreData.
 */
export function CreateFullScoreData<TGame extends V3Game>(
	dryScoreData: DryScore<TGame>["scoreData"],
	chart: ChartDocument<TGame>,
	log: KtLogger,
) {
	const derivedMetrics = DeriveMetrics(dryScoreData, chart);

	const scoreData = {
		...dryScoreData,
		...derivedMetrics,
	} as unknown as ScoreData<TGame>;
	// ^ hacky force-cast because these types are *really* unstable.

	const { indexes, optionalIndexes } = CreateEnumIndexes(chart.game, scoreData, log);

	// again, silly hacks aorund typesafety here because to be honest
	// this stuff is more generic than TS really should ever have to implement.
	scoreData.enumIndexes = indexes;
	scoreData.optional.enumIndexes = optionalIndexes;

	return scoreData;
}
