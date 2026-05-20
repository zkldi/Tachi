import { type Header } from "#components/tables/components/TachiTable";
import { type CSSProperties } from "react";
import {
	type ChartDocument,
	type ClassConfigs,
	type ConfScoreMetrics,
	type Difficulties,
	type integer,
	type PBScoreDocument,
	type ScoreDocument,
	type ScoreRatingAlgorithms,
	type V3Game,
} from "tachi-common";
import { type ExtractEnumMetricNames, type GetEnumValue } from "tachi-common/types/metrics";

export type GPTEnumColours<GPT extends V3Game> = {
	// @ts-expect-error this is fine please do not worry
	[M in ExtractEnumMetricNames<ConfScoreMetrics[GPT]>]: Record<GetEnumValue<GPT, M>, string>;
};

export type GPTEnumIcons<GPT extends V3Game> = {
	[M in ExtractEnumMetricNames<ConfScoreMetrics[GPT]>]: string;
};

export type GPTDifficultyColours<GPT extends V3Game> = Record<Difficulties[GPT], string>;

/**
 * Every GPT has to have some sort of "rating system" for charts defined.
 * The UI uses this to handle things like sorting on the difficulty cell.
 */
export type GPTRatingSystem<GPT extends V3Game> = {
	/**
	 * What qualifies as "achieving" the band in this rating system?
	 * For example, a clear tierlist would use this to discriminate clears
	 * from non-clears.
	 *
	 * Returns a two-tuple. The first is the value that should be displayed to the
	 * end user (i.e. the string lamp when the target is hard clear)
	 * the second is whether they achieved this or not.
	 */
	achievementFn?: (p: PBScoreDocument<GPT> | ScoreDocument<GPT>) => [number | string, boolean];
	description: string;
	enumName: string;

	/**
	 * Does this rating system say this chart has strong individual differences
	 * between players?
	 */
	idvDifference: (c: ChartDocument<GPT>) => boolean | null | undefined;
	name: string;

	toNumber: (c: ChartDocument<GPT>) => number | null | undefined;

	toString: (c: ChartDocument<GPT>) => string | null | undefined;
};

export type GPTClassColours<GPT extends V3Game> = {
	[C in keyof ClassConfigs[GPT]]: {
		// @ts-expect-error it's kinda cool how TS lets me just uhh
		// ignore, errors
		// in the abhorrent stringly based typesystem i have created.
		// Whatever! This works.

		// string => bootstrap variant
		// css properties => css
		// null -> no styling
		[V in ClassConfigs[GPT][C]["values"][number]["id"]]:
			| ({ shine?: boolean } & CSSProperties)
			| "danger"
			| "info"
			| "primary"
			| "secondary"
			| "success"
			| "warning"
			| null;
	};
};

export interface GPTClientImplementation<GPT extends V3Game = V3Game> {
	enumColours: GPTEnumColours<GPT>;

	/**
	 * Fontawesome Icons to use next to enum names.
	 */
	enumIcons: GPTEnumIcons<GPT>;

	difficultyColours: GPTDifficultyColours<GPT>;
	classColours: GPTClassColours<GPT>;

	/**
	 * Other than chart.level and chart.levelNum, what other rating systems exist
	 * for this game?
	 *
	 * You can use this to add things like tierlists (chart.data.ncTier, hcTier, etc.)
	 */
	ratingSystems: Array<GPTRatingSystem<GPT>>;

	/**
	 * Can be used to replace the display name of the algorithm.
	 * (Which defaults to `UppercaseFirst(key)`)
	 * This is particularly useful for renaming old algorithms.
	 */
	ratingAlgNameOverrides?: {
		profile?: Record<string, string>;
		score?: Record<string, string>;
		session?: Record<string, string>;
	};

	/**
	 * Optional styles for the **value** cell (not the label) in the profile stats mini-table,
	 * keyed by profile rating algorithm id. Typically a tinted background.
	 */
	profileRatingAlgRowStyle?: Partial<Record<string, CSSProperties>>;

	/**
	 * What headers should be used when rendering scores in a table for this game?
	 */
	scoreHeaders: Array<Header<PBScoreDocument<GPT> | ScoreDocument<GPT>>>;

	/**
	 * How should we render the "core cells" for a score row in this game?
	 *
	 * This should render exactly the same amount of cells as there are headers.
	 */
	scoreCoreCells: (props: {
		chart: ChartDocument<GPT>;
		sc: PBScoreDocument<GPT> | ScoreDocument<GPT>;
	}) => JSX.Element;

	/**
	 * How should we render the "rating cell" for a score row in this game?
	 *
	 * This is separate from the core cells as not all views in the client want to
	 * necessarily display all four cells at once.
	 *
	 * You can use this to stylise certain things about your game's rating system, like
	 * colouring in jubility with the important colour, or indicating why a user
	 * got 0 points on an unranked chart, etc..
	 */
	ratingCell: (props: {
		chart: ChartDocument<GPT>;
		rating: ScoreRatingAlgorithms[GPT];
		sc: PBScoreDocument<GPT> | ScoreDocument<GPT>;
	}) => JSX.Element;

	/**
	 * How many scores should we consider for the topX in the session important scores
	 * display?
	 */
	sessionImportantScoreCount: integer;

	/**
	 * By default folders are rendered in reverse of `table.folders` (so the highest
	 * level / hardest folder shows first). Set this to flip that back — folders will
	 * then be rendered in the order declared by the table. Used for games like BMS/PMS
	 * where the table is already authored in the order the UI should display.
	 */
	reverseFolderOrder?: boolean;
}
