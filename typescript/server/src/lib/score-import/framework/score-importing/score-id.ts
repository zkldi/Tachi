import type { KtLogger } from "#lib/log/log";

import fjsh from "fast-json-stable-hash";
import {
	GetGameConfig,
	type integer,
	type MongoOptionalMetrics,
	type MongoProvidedMetrics,
	type V3Game,
} from "tachi-common";

import type { DryScore } from "../common/types";

export const LEGACY_CHART_ID_LENGTH = 40;

export function assertLegacyChartIDForScoreID(legacyChartID: string): void {
	if (legacyChartID.length !== LEGACY_CHART_ID_LENGTH) {
		throw new Error(
			`legacyChartID must be exactly ${LEGACY_CHART_ID_LENGTH} characters for score deduplication, got ${legacyChartID.length}`,
		);
	}
}

/**
 * Creates an identifier for this score.
 * This is used to deduplicate repeated scores.
 */
export function CreateScoreID(
	game: V3Game,
	userID: integer,
	dryScore: DryScore,
	legacyChartID: string,
	logger?: KtLogger,
) {
	// scoreIDs CANNOT CHANGE. and we changed the chartID format for v3. So, we _have_ to use
	// the legacyID here instead of the pretty ID.
	//
	// TODO(zk): migrate all scoreIDs over to the new format at some point, this is not that bad
	// if we have on update cascade :3c
	assertLegacyChartIDForScoreID(legacyChartID);

	// Score IDs were historically keyed on the mongo-era chartID (40-char SHA1 hex).
	const elements: Record<string, number | string> = { userID, chartID: legacyChartID };

	const gameConfig = GetGameConfig(game);

	for (const m of Object.keys(gameConfig.providedMetrics)) {
		const metric = m as keyof MongoProvidedMetrics[V3Game];

		elements[metric] = dryScore.scoreData[metric];
	}

	// Also include optional metrics in the checksum if they should be
	// part of the scoreID.
	for (const [m, conf] of Object.entries(gameConfig.optionalMetrics)) {
		const metric = m as keyof MongoOptionalMetrics[V3Game];

		if (conf.partOfScoreID) {
			elements[`optional.${metric}`] = dryScore.scoreData.optional[metric] ?? null;
		}
	}

	// use a stable object hashing method instead of string joining
	// as it's immune to key order or anything screwy like that.
	let hash;

	try {
		hash = fjsh.hash(elements, "sha256");
	} catch (err) {
		logger?.error({ err, elements, dryScore }, `Failed to checksum score`);
		throw err;
	}

	return `T${hash}`;
}
