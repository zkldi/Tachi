import type { integer, V3Game } from "../types";
import type { ChartDocument } from "./documents";
import type { ConfDerivedMetrics, ConfOptionalMetrics, ConfProvidedMetrics } from "./game-config";

// WARNING! THIS FILE IS VERY COMPLEX. THERE IS SOME HIGH-TIER TYPESCRIPT MAGIC GOING
// ON HERE.

// The rough outline is that Tachi allows games to have up to 5 kinds of metrics
// "DECIMAL" | "INTEGER" | "ENUM" | "GRAPH" and "NULLABLE_GRAPH".

// Metrics themselves then come in three groups:
// - Provided: They **must** be provided for a score import to be usable
// - Derived: They **will** be put on a score document, but are a function
// of the provided metrics and the chart this score is on (i.e. Grades for IIDX)
// - Additional: They **may** exist. We want to store them if they exist, but don't
// mandate their existence (i.e. fast/slow/maxCombo)

interface ConfDecimalScoreMetricNormal {
	type: "DECIMAL";
	formatter: (v: number) => string;
	goalTitleFormatter: (value: number) => string;
	goalOutOfFormatter: (value: number) => string;

	validate: (v: number) => string | true;

	// This exists to allow DecimalScoreMetric.chartDependentMax.
	chartDependentMax?: never;
}

interface ConfIntegerScoreMetricNormal {
	type: "INTEGER";
	formatter: (v: number) => string;
	goalTitleFormatter: (value: number) => string;
	goalOutOfFormatter: (value: number) => string;

	validate: (v: number) => string | true;

	// see above
	chartDependentMax?: never;
}

interface ConfDecimalScoreMetricChartDependent {
	type: "DECIMAL";
	formatter: (v: number) => string;
	goalTitleFormatter: (value: number) => string;
	goalOutOfFormatter: (value: number) => string;

	/**
	 * Is the maximum/minimum value of this metric chart dependent?
	 *
	 * @example: IIDX's EX Score is upperbounded at 2x the chart's notecount.
	 */
	chartDependentMax: true;
	allowFolderGoalsIf?: never;
}

interface ConfIntegerScoreMetricChartDependent {
	type: "INTEGER";
	formatter: (v: number) => string;
	goalTitleFormatter: (value: number) => string;
	goalOutOfFormatter: (value: number) => string;

	/**
	 * Is the maximum/minimum value of this metric chart dependent?
	 *
	 * @example: IIDX's EX Score is upperbounded at 2x the chart's notecount.
	 */
	chartDependentMax: true;
	allowFolderGoalsIf?: never;
}

interface ConfDecimalScoreMetricChartDependentWithExemption {
	type: "DECIMAL";
	formatter: (v: number) => string;
	goalTitleFormatter: (value: number) => string;
	goalOutOfFormatter: (value: number) => string;
	validate: (v: number) => string | true;

	/**
	 * When the value is chart dependent,
	 * should folder-wide goals be allowed conditionally?
	 *
	 * @example:
	 * Arcaea's score is upperbounded at 10M+notecount, but scores below 10M
	 * behave as if the max was 10M.
	 */
	allowFolderGoalsIf: (v: number) => boolean;
	chartDependentMax: true;
}

interface ConfIntegerScoreMetricChartDependentWithExemption {
	type: "INTEGER";
	formatter: (v: number) => string;
	goalTitleFormatter: (value: number) => string;
	goalOutOfFormatter: (value: number) => string;
	validate: (v: number) => string | true;

	/**
	 * When the value is chart dependent,
	 * should folder-wide goals be allowed conditionally?
	 *
	 * @example:
	 * Arcaea's score is upperbounded at 10M+notecount, but scores below 10M
	 * behave as if the max was 10M.
	 */
	allowFolderGoalsIf: (v: number) => boolean;
	chartDependentMax: true;
}

export type ConfDecimalScoreMetric =
	| ConfDecimalScoreMetricChartDependent
	| ConfDecimalScoreMetricChartDependentWithExemption
	| ConfDecimalScoreMetricNormal;

export type ConfIntegerScoreMetric =
	| ConfIntegerScoreMetricChartDependent
	| ConfIntegerScoreMetricChartDependentWithExemption
	| ConfIntegerScoreMetricNormal;

/**
 * A metric for a score that represents an enum.
 *
 * This is intended for use for things like clearTypes/lamps/grades. It may be
 * used for anything where a metric is in a known, ordered set of strings.
 */
export interface ConfEnumScoreMetric<V extends string> {
	type: "ENUM";
	values: ReadonlyArray<V>;

	/**
	 * The minimum value that users should care about. Used to prevent UI-issues like saying
	 * "You got 5 new fails/D ranks today!" etc.
	 */
	minimumRelevantValue: V;

	/**
	 * Optional custom formatter for this enum metric's value when used in goal titles.
	 *
	 * When absent, the raw enum string value is used directly.
	 *
	 * @example: ongeki's platinumStars "3-star" → "★★★☆☆"
	 */
	goalTitleFormatter?: (value: V) => string;
}

/**
 * Corresponds to Array<number>
 */
export interface ConfGraphScoreMetric {
	type: "GRAPH";

	validate: (v: number) => string | true;
	size?: (v: number) => string | true;
}

/**
 * Corresponds to Array<number | null>.
 */
export interface ConfNullableGraphScoreMetric {
	type: "NULLABLE_GRAPH";

	validate: (v: number) => string | true;
	size?: (v: number) => string | true;
}

export type ConfScoreMetric = {
	description: string;
} & (
	| ConfDecimalScoreMetric
	| ConfEnumScoreMetric<string>
	| ConfGraphScoreMetric
	| ConfIntegerScoreMetric
	| ConfNullableGraphScoreMetric
);

/**
 * Given a Metric Type, turn it into its evaluated form. An IntegerScoreMetric
 * becomes an integer and an enum becomes a string union, etc.
 */
export type MongoExtractMetricValue<M extends ConfScoreMetric> = M extends ConfDecimalScoreMetric
	? number
	: M extends ConfIntegerScoreMetric
		? integer
		: M extends ConfEnumScoreMetric<infer V>
			? V
			: M extends ConfGraphScoreMetric
				? Array<number>
				: M extends ConfNullableGraphScoreMetric
					? Array<number | null>
					: never;

/**
 * Postgres equivalent of MongoExtractMetricValue
 */
export type PgExtractMetricValue<M extends ConfScoreMetric> = M extends ConfDecimalScoreMetric
	? number
	: M extends ConfIntegerScoreMetric
		? integer
		: M extends ConfEnumScoreMetric<infer _Val>
			? integer
			: M extends ConfGraphScoreMetric
				? Array<number>
				: M extends ConfNullableGraphScoreMetric
					? Array<number | null>
					: never;

/**
 * Extract all the names of enum types from this record of score metrics.
 *
 * This is used for enforcing the "default enum" for a GPT. All games have to have
 * a default, preferred enum, for things like folder raises and graphs.
 *
 * For most games, this will be "grade" or "lamp". However, we need a typesafe way
 * of checking that this metric is an enum.
 *
 * Please ignore how magical this type is. I'm sorry. You aren't expected to understand
 * this.
 *
 * @example
 * ExtractEnumMetricNames<{ score: { type: "INTEGER" } }, grade: { type: "ENUM" ... },
 *  lamp: { type: "ENUM", ... }>
 * would return a type of "grade" | "lamp"
 */
export type ExtractEnumMetricNames<R extends Record<string, ConfScoreMetric>> = {
	[K in keyof R]: R[K] extends ConfEnumScoreMetric<infer _> ? K & string : never;
}[keyof R];

/**
 * What are all the metrics available for this GPT?
 */
export type AllConfMetrics = {
	[TGame in V3Game]: ConfDerivedMetrics[TGame] &
		ConfOptionalMetrics[TGame] &
		ConfProvidedMetrics[TGame];
};

/**
 * Get the string values that can be part of this enum.
 *
 * @usage GetEnumValue<"iidx:SP", "lamp"> = "FAILED" | "ASSIST CLEAR" | "EASY CLEAR" ...
 */
export type GetEnumValue<
	TGame extends V3Game,
	MetricName extends ExtractEnumMetricNames<AllConfMetrics[TGame]>,
> =
	AllConfMetrics[TGame][MetricName] extends ConfEnumScoreMetric<infer EnumValues>
		? EnumValues
		: never;

/**
 * Turn a record of ConfigScoreMetrics into their actual literal values.
 *
 * @example MongoExtractMetrics<{
 *     score: ConfIntegerScoreMetric; lamp: ConfEnumScoreMetric<"FAILED"|"CLEAR">
 * }>
 * will equal
 * { score: integer; lamp: { string: "FAILED" | "CLEAR "..., index: number } }
 */
export type MongoExtractMetrics<R extends Record<string, ConfScoreMetric>> = {
	-readonly [K in keyof R]: MongoExtractMetricValue<R[K]>;
};

export type PgExtractMetrics<R extends Record<string, ConfScoreMetric>> = {
	-readonly [K in keyof R]: PgExtractMetricValue<R[K]>;
};

// We want some signatures for implementing metric "derivers".
// This complex type nonsense effectively gives us a typesafe form for:
// MetricDeriver<"iidx:SP", number>
// (metrics: IIDXSPMetrics, chart: Chart<"iidx:SP"> ) => number

export type DerivedMetricValue = number | string | Array<number> | Array<number | null> | integer;

export type MetricValue = MongoExtractMetricValue<ConfScoreMetric>;

export type MetricDeriver<
	TGame extends V3Game,
	// possible return values
	// from a derived fn
	V extends DerivedMetricValue = DerivedMetricValue,
> = (
	mandatoryMetrics: MongoExtractMetrics<ConfProvidedMetrics[TGame]>,
	chart: ChartDocument<TGame>,
) => V;
