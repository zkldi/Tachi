/**
 * Pure, dependency-free helpers for formatting goal titles.
 *
 * These are shared between tachi-server (which resolves chart/folder names from
 * the database) and tachi-seeds-scripts (which resolves them from in-memory seed
 * maps).  Neither consumer needs to re-implement the criteria-formatting or
 * title-assembly logic.
 */

import type { GradeBoundary } from "../constants/grade-boundaries";
import type { GoalDocument, V3Game } from "../types";

import { GetGameConfig, GetScoreMetricConf } from "../config/config";
import { FmtNumCompact, GetGradeDeltas, staticAssertUnreachable } from "../utils/util";

// ─── Internal helpers (also exported for use by consumers) ────────────────────

export function OnlyFloatToDP(num: number, points = 2) {
	if (Number.isInteger(num)) {
		return num.toFixed(0);
	}

	return num.toFixed(points);
}

export function HumanisedJoinArray(arr: Array<string>, lastJoiner = "or") {
	if (arr.length === 1) {
		return arr[0]!;
	}

	return `${arr.slice(0, arr.length - 1).join(", ")} ${lastJoiner} ${arr[arr.length - 1]!}`;
}

// ─── Shared formatter helpers (exported for use in game configs) ──────────────

export function GoalFmtScore(val: number) {
	return `Get a score of ${val.toLocaleString("en-GB")} on`;
}

export function GoalFmtPercent(val: number, dp = 2) {
	return `Get ${val.toFixed(dp)}% on`;
}

export function GoalOutOfFmtScore(val: number) {
	return val.toLocaleString("en-GB");
}

export function GoalOutOfFmtPercent(val: number, dp = 2) {
	return `${val.toFixed(dp)}%`;
}

/**
 * Given some grade boundaries and some values, format a grade delta for a goal.
 *
 * I.e. if the goal is to S a chart (needing 900k) and the user has 840k, return
 * S-fmtNum(60_000).
 */
export function GradeGoalFormatter<G extends string>(
	gradeBoundaries: Array<GradeBoundary<G>>,
	scoreGrade: G,
	scoreValue: number,
	goalGrade: G,
	formatNumFn = FmtNumCompact,
) {
	const { closer, lower, upper } = GetGradeDeltas(
		gradeBoundaries,
		scoreGrade,
		scoreValue,
		formatNumFn,
	);

	// if upper doesn't exist, we have to return lower (this is a MAX) or something.
	if (!upper) {
		return lower;
	}

	// if the upper bound is relevant to the grade we're looking for
	// i.e. the goal is to AAA a chart and the user has AA+20/AAA-100
	// prefer AAA-100 instead of AA+20.
	if (new RegExp(`^\\(?${goalGrade}\\)?-`, "u").exec(upper)) {
		return upper;
	}

	// otherwise, return whichever is closer.
	return closer === "lower" ? lower : upper;
}

// ─── Core formatting functions ────────────────────────────────────────────────

/**
 * Formats the criteria portion of a goal title (the "Get a score of X on" part).
 *
 * For DECIMAL/INTEGER metrics, the `goalTitleFormatter` from the metric's game
 * config is used. For ENUM metrics the raw enum string value is returned.
 */
export function FormatGoalCriteria(criteria: GoalDocument["criteria"], game: V3Game): string {
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

		return conf.goalTitleFormatter ? conf.goalTitleFormatter(v) : v;
	}

	if (conf.type === "DECIMAL" || conf.type === "INTEGER") {
		return conf.goalTitleFormatter(criteria.value);
	}

	throw new Error(`Cannot set a goal for ${criteria.key} as it is of type ${conf.type}.`);
}

/**
 * Assembles the final goal title from the already-formatted criteria string and
 * dataset string (chart name / folder name / comma-joined chart list).
 *
 * This is pure string logic — callers are responsible for resolving chart IDs and
 * folder IDs to human-readable strings before calling this.
 */
export function AssembleGoalTitle(
	formattedCriteria: string,
	formattedDataset: string,
	criteria: GoalDocument["criteria"],
	charts: GoalDocument["charts"],
): string {
	switch (criteria.mode) {
		case "single":
			switch (charts.type) {
				case "single":
					return `${formattedCriteria} ${formattedDataset}`;
				case "multi": {
					if (charts.data.length === 2) {
						return `${formattedCriteria} either ${formattedDataset}`;
					}

					return `${formattedCriteria} any one of ${formattedDataset}`;
				}

				case "folder":
					return `${formattedCriteria} any chart in ${formattedDataset}`;
				default:
					staticAssertUnreachable(charts);
			}

		// eslint-disable-next-line no-fallthrough
		case "absolute":
			switch (charts.type) {
				case "multi": {
					if (criteria.countNum === charts.data.length) {
						return `${formattedCriteria} ${formattedDataset}`;
					}

					return `${formattedCriteria} any ${criteria.countNum} of ${formattedDataset}`;
				}

				case "folder":
					return `${formattedCriteria} ${criteria.countNum} charts in ${formattedDataset}`;
				case "single":
					throw new Error(
						`Invalid goal — absolute mode cannot be paired with charts.type of 'single'.`,
					);
				default:
					staticAssertUnreachable(charts);
			}

		// eslint-disable-next-line no-fallthrough
		case "proportion": {
			const propFormat = OnlyFloatToDP(criteria.countNum * 100);

			switch (charts.type) {
				case "multi":
					return `${formattedCriteria} ${propFormat}% of ${formattedDataset}`;
				case "folder":
					return `${formattedCriteria} ${propFormat}% of the charts in ${formattedDataset}`;
				case "single":
					throw new Error(
						`Invalid goal — proportion mode cannot be paired with charts.type of 'single'.`,
					);
			}
		}
	}

	throw new Error(
		`Unable to format goal title for mode ${(criteria as GoalDocument["criteria"]).mode}.`,
	);
}
