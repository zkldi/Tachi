import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { GetChartByIdForGame } from "#lib/db-formats/chart";
import { LoadFolderDocumentById } from "#lib/db-formats/folders";
import { GetFolderChartIDs } from "#lib/folders/folders";
import { HumaniseChartID } from "#utils/db";
import { HumanisedJoinArray, staticAssertUnreachable } from "#utils/misc";
import {
	AssembleGoalTitle,
	FormatGame,
	FormatGoalCriteria,
	GetGameConfig,
	GetScoreMetricConf,
	type GoalDocument,
	type V3Game,
} from "tachi-common";

export async function CreateGoalTitle(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	game: V3Game,
) {
	const formattedCriteria = FormatGoalCriteria(criteria, game);
	const datasetName = await FormatCharts(charts, criteria);

	return AssembleGoalTitle(formattedCriteria, datasetName, criteria, charts);
}

async function FormatCharts(charts: GoalDocument["charts"], criteria: GoalDocument["criteria"]) {
	switch (charts.type) {
		case "single":
			return HumaniseChartID(charts.data);
		case "multi": {
			// @inefficient
			// This could be done with significantly less db queries.
			const formattedTitles = await Promise.all(
				charts.data.map((chartID) => HumaniseChartID(chartID)),
			);

			// In the case where this is an absolute query for *all* of these charts
			// we want it to be A, B and C
			// instead of A, B or C
			// for things like CLEAR A, B or C.
			if (criteria.mode === "absolute" && criteria.countNum === charts.data.length) {
				return HumanisedJoinArray(formattedTitles, "and");
			}

			return HumanisedJoinArray(formattedTitles);
		}

		case "folder": {
			const folder = await LoadFolderDocumentById(charts.data);

			if (!folder) {
				throw new Error(`Folder ${charts.data} not found.`);
			}

			return `the ${folder.title} folder`;
		}

		default:
			staticAssertUnreachable(charts);
	}
}

/**
 * Given a goals' charts and criteria properties, evaluate whether those two make
 * any sense at all. There are certain combinations that are illegal, or values that
 * in general just should be constrained out.
 *
 * @warn This function is disgusting. This should have never happened.
 */
export async function ValidateGoalChartsAndCriteria(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	game: V3Game,
) {
	let chartCount = 0;

	// Validating the charts supplied

	switch (charts.type) {
		case "single": {
			const chart = await GetChartByIdForGame(game, charts.data);

			if (!chart) {
				throw new Error(`A chart with id ${charts.data} does not exist for ${game}.`);
			}

			chartCount = 1;
			break;
		}

		case "folder": {
			const folder = await LoadFolderDocumentById(charts.data);

			if (!folder || folder.game !== game) {
				throw new Error(`A folder with id ${charts.data} does not exist for ${game}.`);
			}

			chartCount = (await GetFolderChartIDs(charts.data)).length;
			break;
		}

		case "multi": {
			if (charts.data.length < 2) {
				throw new Error(
					`Invalid charts.data for 'multi' charts. Must specify at least two charts.`,
				);
			}

			const multiCharts = await Promise.all(
				charts.data.map((chartID) => GetChartByIdForGame(game, chartID)),
			);

			if (multiCharts.some((c) => c === undefined)) {
				throw new Error(
					`Expected charts.data to match ${charts.data.length} charts. Instead, it only matched ${multiCharts.filter(Boolean).length}. Are all of these chartIDs valid?`,
				);
			}

			chartCount = multiCharts.length;
			break;
		}

		default:
			staticAssertUnreachable(charts);
	}

	// Validating criteria.mode against countNum.
	if (criteria.mode === "proportion") {
		if (criteria.countNum <= 0 || criteria.countNum > 1) {
			throw new Error(
				`Invalid countNum for goal with criteria.mode of 'proportion'. Expected a decimal in (0, 1]`,
			);
		}

		if (Math.floor(chartCount * criteria.countNum) === 0) {
			throw new Error(
				`countNum (${criteria.countNum}) is too small for a goal with ${chartCount} charts. Would result in requiring 0 charts to achieve the goal.`,
			);
		}
	} else if (
		criteria.mode === "absolute" &&
		(criteria.countNum > chartCount ||
			!Number.isInteger(criteria.countNum) ||
			criteria.countNum < 2)
	) {
		throw new Error(
			`Invalid countNum for goal with criteria.mode of 'absolute'. Expected a whole number less than the total amount of charts available and greater than 1. (Got ${criteria.countNum}, while total charts was ${chartCount}.)`,
		);
	}

	// checking whether the key and value make sense
	const gameConfig = GetGameConfig(game);

	const config = GetScoreMetricConf(gameConfig, criteria.key);

	if (!config) {
		throw new Error(`Invalid criteria.key for ${FormatGame(game)} (Got ${criteria.key}).`);
	}

	const gptImpl = GAME_IMPLEMENTATIONS[game];

	switch (config.type) {
		case "DECIMAL":
		case "INTEGER": {
			const allowFolderGoals =
				config.chartDependentMax !== true || config.allowFolderGoalsIf?.(criteria.value);

			if (!allowFolderGoals && charts.type !== "single") {
				throw new Error(
					`Creating ${criteria.key} goals on multiple charts where the maximum value is relative to the chart is a terrible idea, and has been disabled.`,
				);
			}

			let err;

			if (!allowFolderGoals) {
				const chart = await GetChartByIdForGame(game, charts.data as string);

				if (!chart) {
					throw new Error(
						`Chart ${charts.data} was removed from the database while a goal was being validated on it?`,
					);
				}

				// @ts-expect-error this is fine leave me alone
				err = gptImpl.chartSpecificValidators[criteria.key](criteria.value, chart);
			} else {
				// @ts-expect-error if allowFolderGoals is true, validate has to exist, and tsc's opinion has no weight here.
				err = config.validate(criteria.value);
			}

			if (err !== true) {
				throw new Error(`Invalid value ${criteria.value} for ${criteria.key}, ${err}`);
			}

			break;
		}

		case "ENUM": {
			if (!config.values[criteria.value]) {
				throw new Error(
					`Invalid value of ${criteria.value} for ${criteria.key} goal. No such ${criteria.key} exists at that index.`,
				);
			}

			break;
		}

		case "GRAPH":
		case "NULLABLE_GRAPH":
			throw new Error(`Cannot set a goal on ${criteria.key} as it's a graph metric.`);

		default:
			staticAssertUnreachable(config);
	}

	if (charts.type === "single" && criteria.mode !== "single") {
		throw new Error(`Criteria Mode must be 'single' if Charts Type is 'single'.`);
	}

	if (charts.type === "multi" && criteria.mode === "proportion") {
		throw new Error(
			`Criteria Mode must be 'single' or 'absolute' if Charts Type is 'multi'. Doesn't make sense to have proportional goals when you're capped at 10 charts.`,
		);
	}
}
