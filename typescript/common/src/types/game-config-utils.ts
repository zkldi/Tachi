// Types related to game configuration. These are used by our `internal` game config
// types

export interface RatingAlgorithmConfig {
	/**
	 * Write a short descrption for this rating algorithm.
	 */
	description: string;

	/**
	 * Normally, Tachi will format the result of all rating algorithms in the UI
	 * to two decimal places. However, you may wish to override that functionality
	 * for this algorithm.
	 */
	formatter?: (value: number) => string;
}

/**
 * Config for a **score**-level rating algorithm (i.e. an entry in `scoreRatingAlgs`).
 *
 * Extends the base with `canSetGoalsOn`, which gates whether users are allowed to
 * create goals targeting this algorithm (e.g. "get a BPI of X on this chart").
 */
export interface ScoreRatingAlgorithmConfig extends RatingAlgorithmConfig {
	canSetGoalsOn: boolean;
}

export interface ProfileRatingAlgorithmConfig extends RatingAlgorithmConfig {
	/**
	 * Which score rating algorithms should be mentioned in the footnote
	 * of this algorithm's description?
	 */
	associatedScoreAlgs: ReadonlyArray<string>;

	/**
	 * Sort order in the UI when multiple profile ratings are listed (e.g. profile header
	 * table, settings). Lower numbers appear first; algorithms without this field sort
	 * after those that have it, then by key name.
	 */
	displayOrder?: number;
}

export interface ClassInfo<ClassID extends string> {
	display: string;
	id: ClassID;
	hoverText?: string;
}

interface BaseClassConfig<V extends string> {
	/**
	 * What are the possible values for this class field?
	 *
	 * @note This must be in ascending order.
	 */
	values: Array<ClassInfo<V>>;

	/**
	 * The ID of the lowest class value that should trigger a discord message.
	 * Lower values will be ignored to reduce channel spam.
	 */
	minimumRelevantValue?: V;

	/**
	 * What number of scores is needed to "fill" this class?
	 * If the number of scores is lower, new class values will not
	 * trigger discord messages (useful if minimumRelevantValue is undesired)
	 * For example, a new SDVX player playing their first 50 charts will blitz through
	 * at least 10 of the volforce ranks, which would just result in channel spam.
	 */
	minimumScores?: number;
}

/**
 * This class can only change via imports explicitly stating that this user has this
 * class value.
 *
 * An example of this would be "dan ranking". Since this isn't a function of Tachi
 * state (i.e. you can't derive it from a user's scores or profile), this is "PROVIDED"
 * class, as the import asserts it exists.
 *
 * @note "PROVIDED" classes will never decrease in value. Even if an import asserts that
 * the user is 3rd dan when they've cleared 5th dan in the past, this value will not go
 * back down at any point.
 */
export interface ProvidedClassConfig<V extends string = string> extends BaseClassConfig<V> {
	type: "PROVIDED";
}

/**
 * This class is always derived a user's state on this game.
 *
 * An example of this would be "jubility colours". These are a function of a user's
 * "jubility" profile metric, and therefore are always derived when a new import comes
 * in.
 *
 * @note "DERIVED" classes are always downgradable, as they are a function of state
 * and might go down at any time for any reason.
 */
export interface DerivedClassConfig<V extends string = string> extends BaseClassConfig<V> {
	type: "DERIVED";
}

export type ClassConfig = DerivedClassConfig | ProvidedClassConfig;

type ExtractClassValue<C extends ClassConfig> = C["values"][number]["id"];

/**
 * Get the ID strings for a given class. This results in a record of types like
 *
 * {
 *     colour: "YELLOW" | "GREEN" | "ORANGE" ...
 *     dan: "KAIDEN" | "CHUUDEN" ...
 * }
 */
export type ExtractClassValues<R extends Record<string, ClassConfig>> = {
	[K in keyof R]: ExtractClassValue<R[K]>;
};

/**
 * This game's difficulty names are arbitrary (unique) strings. This makes sense
 * for a lot of home games, where a song may have any number of difficulties
 * attached onto it that we want to care for (think osu!).
 */
export interface DynamicDifficulties {
	type: "DYNAMIC";
}

/**
 * The amount of difficulties that may belong to a song is a fixed possible set.
 *
 * For example, if the game only ever supports Easy, Normal and Hard difficulties
 * this would be static.
 *
 * If the game was more like osu!, where a song can have arbitrary unique strings
 * as difficulty names, you want DynamicDifficulties instead.
 */
export interface FixedDifficulties<Difficulty extends string> {
	type: "FIXED";

	order: ReadonlyArray<Difficulty>;

	/**
	 * How should we format these difficulty names for short usage?
	 * if not specified, will use the difficulty name as-is
	 */
	formatShort: Partial<Record<Difficulty, string>>;

	/**
	 * How should we format these difficulty names for long, full usage?
	 * if not specified, will use the difficulty name as-is
	 */
	formatLong: Partial<Record<Difficulty, string>>;

	default: Difficulty;
}

/**
 * This is for chugekimai; where they have a "fixed" set of difficulties, and then a dynamic amount
 * of difficulties for LUNATIC/WORLD'S END/UTAGE charts. This way, we can have the fixed set and
 * still support the dynamic set of additional ones.
 *
 * This is a bit of a bodge. We don't have a nice way of handling this - but we also don't have a
 * nice way of disambiguating score imports as usual - we can't let people import "i got xxx on
 * the worlds end for yyy", because such a uniqueness relation *does not exist*. the difficulty name
 * is not the unique bit - it is meaningless flavour like the dynamic diffnames.
 *
 * Originally, I called this "SEMI_FIXED", which is the sort of ZK quirkiness you've came to know at
 * this point, but now there's no point, this is for chugekimai, and this makes it clear.
 */
export interface ChuGekiMaiDifficulties<TDifficulty extends string> {
	type: "CHUGEKIMAI_STYLE";

	order: ReadonlyArray<TDifficulty>;

	/**
	 * How should we format these difficulty names?
	 *
	 * Dynamic ones (i.e. ones not in the Order set) are not formatted - they are printed
	 * exactly as-is.
	 */
	formatShort: Partial<Record<TDifficulty, string>>;

	/**
	 * How should we format these difficulty names for long, full usage?
	 * if not specified, will use the difficulty name as-is
	 */
	formatLong: Partial<Record<TDifficulty, string>>;

	default: TDifficulty;
}

export type DifficultyConfig<D extends string = string> =
	| ChuGekiMaiDifficulties<D>
	| DynamicDifficulties
	| FixedDifficulties<D>;
