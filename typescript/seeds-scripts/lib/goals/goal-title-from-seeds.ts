import {
	ALL_GAMES,
	allSupportedGameGroups,
	AssembleGoalTitle,
	type ChartDocument,
	FormatChart,
	FormatGoalCriteria,
	type GoalDocument,
	HumanisedJoinArray,
	type V3Game,
} from "tachi-common";

import { ReadCollection } from "../../util";

export interface GoalTitleContext {
	chartsById: Map<string, ChartDocument>;
	foldersById: Map<string, { title: string }>;
}

export function buildGoalTitleContext(): GoalTitleContext {
	const songsById = new Map<string, Record<string, unknown>>();

	for (const gameGroup of allSupportedGameGroups) {
		for (const song of ReadCollection(`songs-${gameGroup}.json`)) {
			songsById.set(song.id, song);
		}
	}

	const chartsById = new Map<string, ChartDocument>();

	for (const game of ALL_GAMES) {
		for (const chart of ReadCollection(`charts-${game}.json`)) {
			const song = songsById.get(chart.songID);

			if (!song) {
				continue;
			}

			chartsById.set(chart.id, {
				...chart,
				chartID: chart.id,
				game,
				song,
			} as ChartDocument);
		}
	}

	const foldersById = new Map<string, { title: string }>();

	for (const folder of ReadCollection("folders.json")) {
		foldersById.set(folder.id, folder);
	}

	return { chartsById, foldersById };
}

function humaniseChartID(chartID: string, ctx: GoalTitleContext) {
	const chart = ctx.chartsById.get(chartID);

	if (!chart) {
		throw new Error(`Chart ${chartID} not found in seeds.`);
	}

	return FormatChart(chart);
}

function formatCharts(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	ctx: GoalTitleContext,
) {
	switch (charts.type) {
		case "single":
			return humaniseChartID(charts.data, ctx);
		case "multi": {
			const formattedTitles = charts.data.map((chartID) => humaniseChartID(chartID, ctx));

			if (criteria.mode === "absolute" && criteria.countNum === charts.data.length) {
				return HumanisedJoinArray(formattedTitles, "and");
			}

			return HumanisedJoinArray(formattedTitles);
		}

		case "folder": {
			const folder = ctx.foldersById.get(charts.data);

			if (!folder) {
				throw new Error(`Folder ${charts.data} not found in seeds.`);
			}

			return `the ${folder.title} folder`;
		}

		default:
			throw new Error(
				`Invalid goal charts.type -- got ${(charts as GoalDocument["charts"]).type}, which we don't support?`,
			);
	}
}

/**
 * Mirrors server `CreateGoalTitle`, but resolves chart and folder names from seed JSON.
 */
export function createGoalTitleFromSeeds(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	game: V3Game,
	ctx: GoalTitleContext,
) {
	const formattedCriteria = FormatGoalCriteria(criteria, game);
	const datasetName = formatCharts(charts, criteria, ctx);

	return AssembleGoalTitle(formattedCriteria, datasetName, criteria, charts);
}
