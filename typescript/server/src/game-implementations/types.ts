import type { PBScoreDocumentNoRank } from "#lib/score-import/framework/pb/create-pb-doc";
import type {
	ChartDocument,
	ClassConfigs,
	integer,
	MongoDerivedMetrics,
	PBReference,
	ProfileRatingAlgorithms,
	ScoreData,
	ScoreDocument,
	ScoreRatingAlgorithms,
	SessionRatingAlgorithms,
	SpecificUserGameStats,
	V3Game,
} from "tachi-common";
import type { DerivedClassConfig } from "tachi-common/types/game-config-utils";
import type { AllConfMetrics } from "tachi-common/types/metrics";

/**
 * Validate this chart-specific metric. This should return a string representing an
 * error message on failure, and null on success.
 */
export type ChartSpecificMetricValidator<TGame extends V3Game> = (
	metric: number,
	chart: ChartDocument<TGame>,
) => string | true;

interface ChartDependentMax {
	chartDependentMax: true;
}

export type SessionCalculator<TGame extends V3Game> = (
	scoreCalcData: Array<ScoreDocument<TGame>["calculatedData"]>,
) => number | null;

export type ClassDeriver<TGame extends V3Game, V extends string> = (
	profileRatings: SpecificUserGameStats<TGame>["ratings"],
) => V | null | undefined;

// absolutely stupid magic.

// makes a record of all the classes that are derivable,
// and returns a ClassDeriver function for each: i.e.
// wacca has StageUP which is not derivable, and colour (which is)
// so this type will result in
// {
//     colour: ClassDeriver<"YELLOW" | "asdf" ...>
// }
export type GPTClassDeriverFuncs<TGame extends V3Game> = {
	[C in keyof ClassConfigs[TGame] as ClassConfigs[TGame][C] extends DerivedClassConfig
		? C
		: never]: ClassConfigs[TGame][C] extends DerivedClassConfig<infer V>
		? ClassDeriver<TGame, V>
		: never;
};

/**
 * A PBMergeFunction just gets the user for this score and the chart its on.
 * They are expected to mutate the existingPB to add/change whatever
 * properties they feel like should be merged.
 *
 * @note Don't worry about updating enumIndexes. Those are updated for you.
 *
 * They should then return some information (a name and a scoreID) to indicate
 * what this PB is composed of.
 */
export type PBMergeFunction<TGame extends V3Game> = (
	userID: integer,
	chartID: string,
	asOfTimestamp: number | null,
	existingPB: PBScoreDocumentNoRank<TGame>,
) => Promise<PBReference | null>;

/**
 * The only metrics that need validators are those that have `chartDependentMax` set.
 * Otherwise, a validator is built into the ConfScoreMetric.
 */
export type GPTChartSpecificMetricValidators<TGame extends V3Game> = {
	[M in keyof AllConfMetrics[TGame] as AllConfMetrics[TGame][M] extends ChartDependentMax
		? M
		: never]: ChartSpecificMetricValidator<TGame>;
};

/** Derives chart-dependent score metrics (grade, percent, …) from provided score data. */
export type GPTScoreDeriver<TGame extends V3Game> = (
	scoreData: ScoreData<TGame>,
	chart: ChartDocument<TGame>,
) => MongoDerivedMetrics[TGame];

export type GPTScoreCalcs<TGame extends V3Game> = (
	scoreData: ScoreData<TGame>,
	derivedData: MongoDerivedMetrics[TGame],
	chart: ChartDocument<TGame>,
) => Record<ScoreRatingAlgorithms[TGame], number | null>;

/** Session ratings from the session's score calculated-data: f(scoreCalcData) -> sessionCalcData. */
export type GPTSessionCalcs<TGame extends V3Game> = (
	scoreCalcData: Array<ScoreDocument<TGame>["calculatedData"]>,
) => Record<SessionRatingAlgorithms[TGame], number | null>;

/** Profile ratings for a v3 `game`: async f(game, userID) -> profile ratings record. */
export type GPTProfileCalcs<TGame extends V3Game> = (
	game: TGame,
	userID: integer,
) => Promise<Record<ProfileRatingAlgorithms[TGame], number | null>>;

// Class deriver: f(profileRatings) -> derivedClasses (one object with all derived class values).
export type GPTClassDerivers<TGame extends V3Game> = (
	profileRatings: SpecificUserGameStats<TGame>["ratings"],
) => { [C in keyof GPTClassDeriverFuncs<TGame>]: ReturnType<GPTClassDeriverFuncs<TGame>[C]> };

/**
 * The float values used to rank this PB against others on the same chart.
 * Maps directly to the ranking_value + ranking_value_tb1..tb5 columns in postgres.
 *
 * Higher values win (i.e. ORDER BY ranking DESC). All tiebreakers are nullable;
 * null tiebreakers are ignored when ranking.
 */
export interface RankingValues {
	ranking: number;
	tb1: number | null;
	tb2: number | null;
	tb3: number | null;
	tb4: number | null;
	tb5: number | null;
}

/**
 * Given a fully-merged (but not yet stored) PB, return the ranking values
 * that determine how this PB is ordered against other PBs on the same chart.
 */
export type PBRankingValuesFunction<TGame extends V3Game> = (
	pb: PBScoreDocumentNoRank<TGame>,
) => RankingValues;

/**
 * Return nothing on success, and a string
 * indicating what the error was on failure.
 */
export type ScoreValidator<TGame extends V3Game> = (
	score: ScoreDocument<TGame>,
	chart: ChartDocument<TGame>,
) => string | undefined;

export interface GameImplementation<TGame extends V3Game> {
	/**
	 * For any chart-dependent metrics, such as EX Score for IIDX, how should we
	 * validate they're correct?
	 */
	chartSpecificValidators: GPTChartSpecificMetricValidators<TGame>;

	/**
	 * How should we derive the derived metrics for this game?
	 */
	scoreDeriver: GPTScoreDeriver<TGame>;

	/**
	 * How should we compute the score rating algorithms for this game?
	 */
	scoreCalcs: GPTScoreCalcs<TGame>;

	/**
	 * How should we compute session ratings for this game?
	 */
	sessionCalcs: GPTSessionCalcs<TGame>;

	/**
	 * How should we compute profile ratings for this game?
	 */
	profileCalcs: GPTProfileCalcs<TGame>;

	/**
	 * For any "derived" classes for this game (i.e. classes that are the function
	 * of the user's state), how should they work?
	 */
	classDerivers: GPTClassDerivers<TGame>;

	/**
	 * How should we mutate PBs (to join best lamps, lowest BPs, etc.) for this GPT?
	 */
	pbMergeFunctions: Array<PBMergeFunction<TGame>>;

	/**
	 * A PB is always initialised with the best score for this game's default
	 * metric. What should that be called?
	 */
	defaultMergeRefName: string;

	/**
	 * Given a fully-merged PB, return the integer ranking values used to sort
	 * this PB against all others on the same chart (higher = better rank).
	 *
	 * These map to ranking_value + ranking_value_tb1..tb5 in postgres.
	 */
	pbRankingValues: PBRankingValuesFunction<TGame>;

	/**
	 * There are various things that should be true about scores for each game
	 * that aren't already checked. This is for invariants that can't be tested
	 * otherwise, like judgements properly summing up to the EX Score for IIDX, etc.
	 *
	 * These are for checking things that are *obviously* incorrect. For more subtle
	 * incorrectnesses, like working out what the minimum possible full combo score
	 * could be (which might be chart dependent, etc), don't bother.
	 */
	scoreValidators: Array<ScoreValidator<TGame>>;

	/**
	 * Chart field paths whose values feed into
	 * `scoreDeriver` or `scoreCalcs`.
	 *
	 * When any of these change on a chart,
	 * all scores on that chart must be re-derived.
	 *
	 * Used to build a stable checksum stored on `chart.derivation_checksum`.
	 */
	chartDataRelevantFields: Array<string>;
}

export type GameImplementations = {
	[TGame in V3Game]: GameImplementation<TGame>;
};
