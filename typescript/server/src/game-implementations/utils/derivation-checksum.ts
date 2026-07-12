import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import fjsh from "fast-json-stable-hash";
import get from "lodash/get";
import { type ChartDocument, type V3Game } from "tachi-common";

function ComputeChartStabilityChecksumInner(chart: ChartDocument, fields: Array<string>): string {
	const extracted: Record<string, unknown> = {};

	for (const field of fields.slice(0).sort()) {
		const value = get(chart, field);
		if (value === undefined) {
			continue;
		}
		extracted[field] = value;
	}

	return fjsh.hash(extracted, "sha256");
}

/**
 * Compute a stable SHA-256 hex digest over the subset of chart fields that
 * affect score derivation for a given game.
 *
 * The checksum is deterministic: same field values always produce the same
 * hash, regardless of object key ordering.
 */
export function ComputeChartStabilityChecksum(game: V3Game, chart: ChartDocument): string {
	const impl = GAME_IMPLEMENTATIONS[game];

	return ComputeChartStabilityChecksumInner(chart, impl.chartDataRelevantFields);
}
