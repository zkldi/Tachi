import type { ZodObject } from "zod";

import type { MatchTypes } from "./batch-manual";
import type {
	ClassConfig,
	DifficultyConfig,
	ProfileRatingAlgorithmConfig,
	RatingAlgorithmConfig,
} from "./game-config-utils";
import type { ConfScoreMetric } from "./metrics";

import { type V3Game } from "../types";

/**
 * What's the "mold" for a game config? All game configs *must* satisfy this interface.
 *
 * @see {GameConfig} for the intended-to-use type. This is an *outline* for a game
 * config, and has significantly less typesafety.
 *
 * Documentation for this type can be found in `game-support.ts`, which has the
 * GameConfig type, which actually has documentation.
 */
export type INTERNAL_GAME_CONFIG = Readonly<{
	chartData: ZodObject;

	classes: Record<string, ClassConfig>;

	defaultMetric: string;

	defaultProfileRatingAlg: string;

	defaultScoreRatingAlg: string;

	defaultSessionRatingAlg: string;
	derivedMetrics: Record<string, ConfScoreMetric>;
	difficulties: DifficultyConfig;

	optionalMetrics: Record<
		string,
		{
			/**
			 * Should this optional metric be part of a score's unique
			 * identifier?
			 *
			 * This should be used for extreme cases, like when a game introduces
			 * a new scoring system that still needs to be optional, but players
			 * don't want to be clobbered.
			 */
			partOfScoreID?: boolean;
		} & ConfScoreMetric
	>;
	orderedJudgements: ReadonlyArray<string>;

	preferences: ZodObject;

	preferredDefaultEnum: string;

	profileRatingAlgs: Record<string, ProfileRatingAlgorithmConfig>;

	providedMetrics: Record<string, ConfScoreMetric>;

	scoreMeta: ZodObject;

	scoreRatingAlgs: Record<string, RatingAlgorithmConfig>;
	sessionRatingAlgs: Record<string, RatingAlgorithmConfig>;
	supportedMatchTypes: ReadonlyArray<MatchTypes>;
	versions: Record<string, string>;
}>;

/**
 * A game group config *must* satisfy this, but we don't export this kind of game config.
 *
 * Think of this like a "mold" for a game config, it's gotta be shaped like this,
 * but interacting with the mold is a little too malleable for the rest of the
 * codebase. @see {GameGroupConfig} for the exported version.
 */
export type INTERNAL_GAME_GROUP_CONFIG<PT extends string = string> = Readonly<{
	dynamicContent: boolean;
	games: ReadonlyArray<V3Game>;
	name: string;
	/**
	 * @deprecated - Legacy V2 way of referring to games, uses gameGroup+playtype as game ID
	 * instead of just "Game".
	 */
	playtypes: ReadonlyArray<PT>;
	songData: ZodObject;
}>;
