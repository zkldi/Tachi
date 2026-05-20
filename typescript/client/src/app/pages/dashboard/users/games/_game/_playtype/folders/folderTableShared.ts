import type { FolderStatsInfo, TableEvolutionEventAPI } from "#types/api-returns";

import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import {
	type FolderDocument,
	type GameConfig,
	GetScoreMetricConf,
	type integer,
	type TableDocument,
	type UserDocument,
	type V3Game,
} from "tachi-common";

export type FolderTableScopedProps = {
	game: V3Game;
	reqUser: UserDocument;
};

export interface UGPTFolderStats {
	folder: FolderDocument;
	stats: FolderStatsInfo;
}

/**
 * Resolve the order folder slugs should be rendered for `table` in `game`.
 *
 * `table.folders` is ascending (e.g. Level 1 … 12), and by default we reverse so the
 * highest folder / level renders first. Games can opt out via `reverseFolderOrder` on
 * their GPT client impl, in which case we reverse again — i.e. render in the table's
 * declared order (currently used for BMS/PMS).
 */
export function tableFolderSlugsDisplayOrder(table: TableDocument, game: V3Game): string[] {
	const reverseAgain = GPT_CLIENT_IMPLEMENTATIONS[game].reverseFolderOrder ?? false;

	return reverseAgain ? [...table.folders] : [...table.folders].reverse();
}

export function evoEventTimeMs(ev: TableEvolutionEventAPI): number {
	return ev.timeAchieved ?? ev.timeAdded;
}

export function buildEvolutionReplayFolderStats(opts: {
	enumMetric: string;
	eventsPrefix: TableEvolutionEventAPI[];
	folderChartIDs: Record<string, string[]>;
	folderSlug: string;
	gameConfig: GameConfig;
}): FolderStatsInfo {
	const chartIds = opts.folderChartIDs[opts.folderSlug] ?? [];

	const metricConf = GetScoreMetricConf(opts.gameConfig, opts.enumMetric);
	if (metricConf.type !== "ENUM") {
		return { slug: opts.folderSlug, chartCount: chartIds.length, stats: {} };
	}

	const peakByMetricByChart = new Map<string, Record<string, number>>();

	for (const ev of opts.eventsPrefix) {
		const forChart = peakByMetricByChart.get(ev.chartID) ?? {};
		forChart[ev.metric] = ev.enumIndex;
		peakByMetricByChart.set(ev.chartID, forChart);
	}

	const bucket: Record<string, integer> = {};

	for (const cid of chartIds) {
		const idx = peakByMetricByChart.get(cid)?.[opts.enumMetric];
		if (idx === undefined) {
			continue;
		}
		const lbl = metricConf.values[idx];
		if (!lbl) {
			continue;
		}
		bucket[lbl] = (bucket[lbl] ?? 0) + 1;
	}

	return {
		slug: opts.folderSlug,
		chartCount: chartIds.length,
		stats: { [opts.enumMetric]: bucket },
	};
}
