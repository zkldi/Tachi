import {
	ALL_GAMES,
	allSupportedGameGroups,
	type ChartDocument,
	FormatChart,
	GetGameConfig,
	GetScoreMetricConf,
	type GoalDocument,
	type V3Game,
} from "tachi-common";

import { ReadCollection } from "../../util";

// temporary bullshit copypasted from tachi-server
// todo: move to tachi common

function humanisedJoinArray(arr: Array<string>, lastJoiner = "or") {
	if (arr.length === 1) {
		return arr[0]!;
	}

	return `${arr.slice(0, arr.length - 1).join(", ")} ${lastJoiner} ${arr[arr.length - 1]!}`;
}

function onlyFloatToDP(num: number, points = 2) {
	if (Number.isInteger(num)) {
		return num.toFixed(0);
	}

	return num.toFixed(points);
}

function goalFmtPercent(val: number, dp = 2) {
	return `Get ${val.toFixed(dp)}% on`;
}

function goalFmtScore(val: number) {
	return `Get a score of ${val.toLocaleString("en-GB")} on`;
}

const GOAL_CRITERIA_FORMATTERS: Partial<
	Record<V3Game, Partial<Record<string, (value: number) => string>>>
> = {
	"iidx-sp": {
		percent: goalFmtPercent,
		score: (v) => `Get a score of ${v} on`,
	},
	sdvx: {
		score: goalFmtScore,
	},
};

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

function formatCriteria(criteria: GoalDocument["criteria"], game: V3Game) {
	const gameConfig = GetGameConfig(game);
	const conf = GetScoreMetricConf(gameConfig, criteria.key);

	if (!conf) {
		throw new Error(`Invalid goal criteria with key ${criteria.key}. No config exists?`);
	}

	if (conf.type === "ENUM") {
		const fmt = GOAL_CRITERIA_FORMATTERS[game]?.[criteria.key];
		const v = conf.values[criteria.value];

		if (v === undefined) {
			throw new Error(`Invalid criteria value '${criteria.value}'.`);
		}

		return fmt ? fmt(criteria.value) : v;
	}

	if (conf.type === "DECIMAL" || conf.type === "INTEGER") {
		const fmt = GOAL_CRITERIA_FORMATTERS[game]?.[criteria.key];

		if (!fmt) {
			throw new Error(`No formatter defined for ${criteria.key}, yet one must exist?`);
		}

		return fmt(criteria.value);
	}

	throw new Error(`Cannot set a goal for ${criteria.key} as it is of type ${conf.type}.`);
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
				return humanisedJoinArray(formattedTitles, "and");
			}

			return humanisedJoinArray(formattedTitles);
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
	const formattedCriteria = formatCriteria(criteria, game);
	const datasetName = formatCharts(charts, criteria, ctx);

	switch (criteria.mode) {
		case "single":
			switch (charts.type) {
				case "single":
					return `${formattedCriteria} ${datasetName}`;
				case "multi": {
					if (charts.data.length === 2) {
						return `${formattedCriteria} either ${datasetName}`;
					}

					return `${formattedCriteria} any one of ${datasetName}`;
				}
				case "folder":
					return `${formattedCriteria} any chart in ${datasetName}`;
			}
			break;

		case "absolute":
			switch (charts.type) {
				case "multi": {
					if (criteria.countNum === charts.data.length) {
						return `${formattedCriteria} ${datasetName}`;
					}

					return `${formattedCriteria} any ${criteria.countNum} of ${datasetName}`;
				}
				case "folder":
					return `${formattedCriteria} ${criteria.countNum} charts in ${datasetName}`;
				case "single":
					throw new Error(
						`Invalid goal -- absolute mode cannot be paired with a charts.type of 'single'.`,
					);
			}
			break;

		case "proportion": {
			const propFormat = onlyFloatToDP(criteria.countNum * 100);

			switch (charts.type) {
				case "multi":
					return `${formattedCriteria} ${propFormat}% of ${datasetName}`;
				case "folder":
					return `${formattedCriteria} ${propFormat}% of the charts in ${datasetName}`;
				case "single":
					throw new Error(
						`Invalid goal -- proportion mode cannot be paired with a charts.type of 'single'.`,
					);
			}
		}
	}

	throw new Error(`Unable to format goal title for mode ${criteria.mode}.`);
}
