import type { GoalCriteriaFormatter } from "#game-implementations/types";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { GetChartByIdForGame } from "#lib/db-formats/chart";
import { LoadFolderDocumentById } from "#lib/db-formats/folders";
import { GetFolderChartIDs } from "#lib/folders/folders";
import { HumaniseChartID } from "#utils/db";
import { HumanisedJoinArray, OnlyFloatToDP } from "#utils/misc";
import {
	FormatGame,
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
	const formattedCriteria = FormatCriteria(criteria, game);

	const datasetName = await FormatCharts(charts, criteria);

	// Formatting this stuff into english is hard and excruciatingly manual.
	switch (criteria.mode) {
		case "single":
			switch (charts.type) {
				case "single":
					return `${formattedCriteria} ${datasetName}`;

				case "multi": {
					if (charts.data.length === 2) {
						// CLEAR either A or B
						return `${formattedCriteria} either ${datasetName}`;
					}

					// CLEAR any of A, B or C.
					return `${formattedCriteria} any one of ${datasetName}`;
				}

				case "folder":
					return `${formattedCriteria} any chart in ${datasetName}`;
			}

		// Eslint can't figure out that the above switches are safely exhastive. Ah well.
		// eslint-disable-next-line no-fallthrough
		case "absolute":
			switch (charts.type) {
				case "multi": {
					// CLEAR all of A, B and C
					if (criteria.countNum === charts.data.length) {
						return `${formattedCriteria} ${datasetName}`;
					}

					// CLEAR any 2 of A, B or C
					return `${formattedCriteria} any ${criteria.countNum} of ${datasetName}`;
				}

				case "folder":
					return `${formattedCriteria} ${criteria.countNum} charts in ${datasetName}`;
				case "single":
					throw new Error(
						`Invalid goal -- absolute mode cannot be paired with a charts.type of 'single'.`,
					);
			}

		// See above about switch exhaustivity
		// eslint-disable-next-line no-fallthrough
		case "proportion": {
			const propFormat = OnlyFloatToDP(criteria.countNum * 100);

			switch (charts.type) {
				case "multi":
					return `${formattedCriteria} ${propFormat}% of ${datasetName}`;
				case "folder":
					return `${formattedCriteria} ${propFormat}% of the charts in ${datasetName}`;
				case "single":
					throw new Error(
						`Invalid goal -- absolute mode cannot be paired with a charts.type of 'single'.`,
					);
			}
		}
	}
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
			throw new Error(
				`Invalid goal charts.type -- got ${
					(charts as GoalDocument["charts"]).type
				}, which we don't support?`,
			);
	}
}

function FormatCriteria<TGame extends V3Game>(
	criteria: GoalDocument<TGame>["criteria"],
	game: TGame,
) {
	const gameConfig = GetGameConfig(game);

	const conf = GetScoreMetricConf(gameConfig, criteria.key);

	if (!conf) {
		throw new Error(`Invalid goal criteria with key ${criteria.key}. No config exists?`);
	}

	if (conf.type === "ENUM") {
		const v = conf.values[criteria.value];

		if (v === undefined) {
			throw new Error(`Invalid criteria value '${criteria.value}'.`);
		}

		return v;
	} else if (conf.type === "DECIMAL" || conf.type === "INTEGER") {
		const fmt: GoalCriteriaFormatter | undefined =
			// @ts-expect-error it still thinks criteria.key might be a symbol.
			GAME_IMPLEMENTATIONS[game].goalCriteriaFormatters[criteria.key];

		if (!fmt) {
			throw new Error(`No formatter defined for ${criteria.key}, yet one must exist?`);
		}

		return fmt(criteria.value);
	}

	throw new Error(`Cannot set a goal for ${criteria.key} as it is of type ${conf.type}.`);
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
			// @ts-expect-error Charts is stated to be never here, but if we get to this point it's
			// effectively unknown
			throw new Error(`Invalid goal.charts.type of ${charts.type}.`);
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
			if (config.chartDependentMax && charts.type !== "single") {
				throw new Error(
					`Creating ${criteria.key} goals on multiple charts where the maximum value is relative to the chart is a terrible idea, and has been disabled.`,
				);
			}

			let err;

			if (config.chartDependentMax) {
				const chart = await GetChartByIdForGame(game, charts.data as string);

				if (!chart) {
					throw new Error(
						`Chart ${charts.data} was removed from the database while a goal was being validated on it?`,
					);
				}

				// @ts-expect-error this is fine leave me alone
				err = gptImpl.chartSpecificValidators[criteria.key](criteria.value, chart);
			} else {
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
