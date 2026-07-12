import type { z, ZodObject } from "zod";

import type { GAME_CONFIGS, GAME_GROUP_CONFIGS } from "../config/config";
import type { integer } from "../types";
import type { MatchTypes } from "./batch-manual";
import type {
	ExtractClassValues,
	FixedDifficulties,
	ProfileRatingAlgorithmConfig,
	RatingAlgorithmConfig,
	ScoreRatingAlgorithmConfig,
} from "./game-config-utils";
import type { INTERNAL_GAME_CONFIG } from "./internals";
import type {
	ExtractEnumMetricNames,
	MongoExtractMetrics as MongoExtractMetrics,
	PgExtractMetrics,
} from "./metrics";
import type { AllFieldsNullableOptional, ExtractArrayElementType } from "./utils";

/**
 * All the game groups Tachi supports.
 */
export type GameGroup = keyof typeof GAME_GROUP_CONFIGS;

/**
 * LEGACY. Game + Playtype was the v2 way of identifying games.
 *
 * ---
 *
 * What game + playtypes does Tachi support? We typically shorten this concept
 * to a "GPT", or Game+Playtype.
 *
 * The keys on the left are the games Tachi supports. The value of those keys
 * are the playtypes that game has.
 *
 * A playtype is a way of splitting a game up into sub, completely separate games.
 * A good example is the difference between IIDX SP and IIDX DP. Although they share
 * songs and a *lot* of logic, they should be completely separate when it comes to
 * storing scores and user profiles.
 *
 * For games that don't really have a meaningful concept of "playtypes", "Single"
 * is the go-to.
 *
 * @deprecated
 */
export type LEGACY_Playtypes = {
	[G in GameGroup]: (typeof GAME_GROUP_CONFIGS)[G]["playtypes"][number];
};

/**
 * Expresses any playtype (for any game). Alias for LEGACY_Playtypes[Game].
 *
 * @deprecated
 */
export type LEGACY_Playtype = LEGACY_Playtypes[GameGroup];

export type SongDocumentData = {
	[G in GameGroup]: z.infer<(typeof GAME_GROUP_CONFIGS)[G]["songData"]>;
};

/**
 * Configuration for the given game. This declares things like its user-facing name
 * and what playtypes it supports.
 */
export interface GameGroupConfig<G extends GameGroup = GameGroup> {
	/**
	 * A pretty name for this game group.
	 */
	readonly name: string;
	/**
	 * In tachi 2, games were identified by a GameGroup + playtype. In Tachi 3,
	 * games are just identified by the Game.
	 *
	 * This is for backwards compatibility with the old system, and the v1 api.
	 *
	 * @deprecated Use `games` instead.
	 */
	readonly playtypes: ReadonlyArray<LEGACY_Playtypes[G]>;
	/**
	 * What games are in this group?
	 */
	readonly games: ReadonlyArray<V3Game>;
	/**
	 * Songs are the only thing that are meaningfully part of a "game group" but not a game
	 * itself - basically, for sharing song data between games.
	 */
	readonly songData: ZodObject;
	/**
	 * Whether this game group's charts or songs are driven by dynamic / user-supplied
	 * data rather than fixed arcade-style metadata.
	 */
	readonly dynamicContent: boolean;
}

/**
 * GPTStrings are an legacy identifier used to identify GameGroup + Playtype combos.
 *
 * These are used in places where we want to switch over all supported game + playtype
 * combos.
 *
 * The below type magic automatically creates all combinations like iidx:SP, iidx:DP...
 * using the `Playtypes` thing above.
 *
 * @deprecated Use V3Game instead.
 */
export type LEGACY_GPTString = keyof {
	[G in GameGroup as `${G}:${LEGACY_Playtypes[G]}`]: never;
};

export type V3Game =
	| "arcaea"
	| "bms-7k"
	| "bms-14k"
	| "chunithm"
	| "ddr-dp"
	| "ddr-sp"
	| "gitadora-dora"
	| "gitadora-gita"
	| "iidx-dp"
	| "iidx-sp"
	| "itg-stamina"
	| "jubeat"
	| "maimai"
	| "maimaidx"
	| "museca"
	| "ongeki"
	| "pms-controller"
	| "pms-keyboard"
	| "popn"
	| "sdvx"
	| "usc-controller"
	| "usc-keyboard"
	| "wacca";

export interface GameGroupFromGame {
	arcaea: "arcaea";
	"bms-7k": "bms";
	"bms-14k": "bms";
	chunithm: "chunithm";
	"ddr-dp": "ddr";
	"ddr-sp": "ddr";
	"gitadora-dora": "gitadora";
	"gitadora-gita": "gitadora";
	"iidx-dp": "iidx";
	"iidx-sp": "iidx";
	"itg-stamina": "itg";
	jubeat: "jubeat";
	maimai: "maimai";
	maimaidx: "maimaidx";
	museca: "museca";
	ongeki: "ongeki";
	"pms-controller": "pms";
	"pms-keyboard": "pms";
	popn: "popn";
	sdvx: "sdvx";
	"usc-controller": "usc";
	"usc-keyboard": "usc";
	wacca: "wacca";
}

/**
 * @deprecated
 */
export type LEGACY_V3GameToGPTString = {
	arcaea: "arcaea:Touch";
	"bms-7k": "bms:7K";
	"bms-14k": "bms:14K";
	chunithm: "chunithm:Single";
	"ddr-dp": "ddr:DP";
	"ddr-sp": "ddr:SP";
	"gitadora-dora": "gitadora:Dora";
	"gitadora-gita": "gitadora:Gita";
	"iidx-dp": "iidx:DP";
	"iidx-sp": "iidx:SP";
	"itg-stamina": "itg:Stamina";
	jubeat: "jubeat:Single";
	maimai: "maimai:Single";
	maimaidx: "maimaidx:Single";
	museca: "museca:Single";
	ongeki: "ongeki:Single";
	"pms-controller": "pms:Controller";
	"pms-keyboard": "pms:Keyboard";
	popn: "popn:9B";
	sdvx: "sdvx:Single";
	"usc-controller": "usc:Controller";
	"usc-keyboard": "usc:Keyboard";
	wacca: "wacca:Single";
};

/**
 * @deprecated
 */
export type LEGACY_GPTStringToV3Game = {
	"arcaea:Touch": "arcaea";
	"bms:7K": "bms-7k";
	"bms:14K": "bms-14k";
	"chunithm:Single": "chunithm";
	"ddr:DP": "ddr-dp";
	"ddr:SP": "ddr-sp";
	"gitadora:Dora": "gitadora-dora";
	"gitadora:Gita": "gitadora-gita";
	"iidx:DP": "iidx-dp";
	"iidx:SP": "iidx-sp";
	"itg:Stamina": "itg-stamina";
	"jubeat:Single": "jubeat";
	"maimai:Single": "maimai";
	"maimaidx:Single": "maimaidx";
	"museca:Single": "museca";
	"ongeki:Single": "ongeki";
	"pms:Controller": "pms-controller";
	"pms:Keyboard": "pms-keyboard";
	"popn:9B": "popn";
	"sdvx:Single": "sdvx";
	"usc:Controller": "usc-controller";
	"usc:Keyboard": "usc-keyboard";
	"wacca:Single": "wacca";
};

/// Get all the games that exist for this game group.
export type GamesForGroup = {
	[G in GameGroup]: (typeof GAME_GROUP_CONFIGS)[G]["games"][number];
};

/**
 * @deprecated Use V3Game instead.
 */
export type LEGACY_GPTStrings = {
	[G in GameGroup]: `${G}:${LEGACY_Playtypes[G]}`;
};

/**
 * @deprecated
 */
export type LEGACY_GetGameGroupFromGPTString<GPT extends LEGACY_GPTString> =
	GPT extends `${infer G}:${infer _}` ? G : never;
/**
 * @deprecated
 */
export type LEGACY_GetPlaytypeFromGPTString<GPT extends LEGACY_GPTString> =
	GPT extends `${infer _}:${infer PT}` ? PT : never;

// Now that we've got GPTString defined, we can define "lookup types" for things about this GPT.
// For example, if we have a function that works with IIDX's difficulties, we want a type like
// Difficulties["iidx:SP"] which expresses those difficulties.

export type LEGACY_GPTStringToGameGroup = {
	[GPT in LEGACY_GPTString]: LEGACY_GetGameGroupFromGPTString<GPT>;
};

export type LEGACY_GPTStringToPlaytype = {
	[GPT in LEGACY_GPTString]: LEGACY_GetPlaytypeFromGPTString<GPT>;
};

export type LEGACY_GameToPlaytype = {
	[TGame in V3Game]: LEGACY_Playtypes[LEGACY_GetGameGroupFromGPTString<
		LEGACY_V3GameToGPTString[TGame]
	>];
};

export type Difficulties = {
	// If this game has fixed difficulties, infer what they are
	// otherwise, difficulties are an arbitrary string
	// n.b. still true even with the new chugekimai stuff
	[TGame in V3Game]: (typeof GAME_CONFIGS)[TGame]["difficulties"] extends FixedDifficulties<
		infer D
	>
		? D
		: string;
};

export type DifficultyConfigs = {
	[TGame in V3Game]: (typeof GAME_CONFIGS)[TGame]["difficulties"];
};

export type Judgements = {
	[TGame in V3Game]: ExtractArrayElementType<(typeof GAME_CONFIGS)[TGame]["orderedJudgements"]>;
};

export type Versions = {
	// https://stackoverflow.com/questions/51808160/keyof-inferring-string-number-when-key-is-only-a-string
	[TGame in V3Game]: keyof (typeof GAME_CONFIGS)[TGame]["versions"] & string;
};

export type ScoreRatingAlgorithms = {
	[TGame in V3Game]: keyof (typeof GAME_CONFIGS)[TGame]["scoreRatingAlgs"] & string;
};

export type SessionRatingAlgorithms = {
	[TGame in V3Game]: keyof (typeof GAME_CONFIGS)[TGame]["sessionRatingAlgs"] & string;
};

export type ProfileRatingAlgorithms = {
	[TGame in V3Game]: keyof (typeof GAME_CONFIGS)[TGame]["profileRatingAlgs"] & string;
};

export type AnyScoreRatingAlg = ScoreRatingAlgorithms[V3Game];
export type AnySessionRatingAlg = SessionRatingAlgorithms[V3Game];
export type AnyProfileRatingAlg = ProfileRatingAlgorithms[V3Game];

export type ConfProvidedMetrics = {
	[TGame in V3Game]: (typeof GAME_CONFIGS)[TGame]["providedMetrics"];
};

export type ConfDerivedMetrics = {
	[TGame in V3Game]: (typeof GAME_CONFIGS)[TGame]["derivedMetrics"];
};

export type ConfOptionalMetrics = {
	[TGame in V3Game]: (typeof GAME_CONFIGS)[TGame]["optionalMetrics"];
};

export type ConfScoreMetrics = {
	[TGame in V3Game]: ConfDerivedMetrics[TGame] & ConfProvidedMetrics[TGame];
};

export type ExtractedClasses = {
	[TGame in V3Game]: ExtractClassValues<(typeof GAME_CONFIGS)[TGame]["classes"]>;
};

export type AnyClasses = {
	[C in Classes[V3Game]]?: string | null;
};

export type Classes = {
	[TGame in V3Game]: keyof (typeof GAME_CONFIGS)[TGame]["classes"] & string;
};

export type ClassConfigs = {
	[TGame in V3Game]: (typeof GAME_CONFIGS)[TGame]["classes"];
};

export type ChartDocumentData = {
	[TGame in V3Game]: z.infer<(typeof GAME_CONFIGS)[TGame]["chartData"]>;
};

export type Preferences = {
	[TGame in V3Game]: z.infer<(typeof GAME_CONFIGS)[TGame]["preferences"]>;
};

export type ScoreMeta = {
	[TGame in V3Game]: z.infer<(typeof GAME_CONFIGS)[TGame]["scoreMeta"]>;
};

export type MongoProvidedMetrics = {
	[TGame in V3Game]: MongoExtractMetrics<(typeof GAME_CONFIGS)[TGame]["providedMetrics"]>;
};

export type MongoDerivedMetrics = {
	[TGame in V3Game]: MongoExtractMetrics<(typeof GAME_CONFIGS)[TGame]["derivedMetrics"]>;
};

export type PgProvidedMetrics = {
	[TGame in V3Game]: PgExtractMetrics<(typeof GAME_CONFIGS)[TGame]["providedMetrics"]>;
};
export type PgOptionalMetrics = {
	[TGame in V3Game]: PgExtractMetrics<(typeof GAME_CONFIGS)[TGame]["optionalMetrics"]>;
};
export type PgDerivedMetrics = {
	[TGame in V3Game]: PgExtractMetrics<(typeof GAME_CONFIGS)[TGame]["derivedMetrics"]>;
};

/**
 * Top level metrics on a score.
 */
export type MongoScoreMetrics = {
	[TGame in V3Game]: MongoDerivedMetrics[TGame] & MongoProvidedMetrics[TGame];
};

export type MongoOptionalMetrics = {
	[TGame in V3Game]: AllFieldsNullableOptional<
		MongoExtractMetrics<(typeof GAME_CONFIGS)[TGame]["optionalMetrics"]>
	>;
};

/**
 * Alongside strings, we want to store integers to represent the integer value
 * of enums.
 */
export type ScoreEnumIndexes<TGame extends V3Game> = Record<
	ExtractEnumMetricNames<ConfDerivedMetrics[TGame] & ConfProvidedMetrics[TGame]>,
	integer
>;

/**
 * Same as ScoreEnumIndexes but for the optional properties on a score.
 */
export type OptionalEnumIndexes<TGame extends V3Game> = Partial<
	Record<ExtractEnumMetricNames<ConfOptionalMetrics[TGame]>, integer>
>;

/**
 * A generic GameConfig. This type is significantly less specific than the
 * "SpecificGameConfig", which only really works as a type if you know *what*
 * GameConfig you're working with.
 */
export type GameConfig = {
	defaultProfileRatingAlg: ProfileRatingAlgorithms[V3Game];
	defaultScoreRatingAlg: ScoreRatingAlgorithms[V3Game];
	defaultSessionRatingAlg: SessionRatingAlgorithms[V3Game];
} & INTERNAL_GAME_CONFIG;

/**
 * Configuration for a game. This declares *almost everything* about how this game is
 * implemented in Tachi, such as what metrics it supports, how it handles chart
 * difficulties, etc.
 *
 * To get a GameConfig for a given Game + Playtype, @see {GetGameConfig}
 */
export interface SpecificGameConfig<TGame extends V3Game> {
	/**
	 * What metrics **must** be provided in order for this score to be usable by
	 * Tachi?
	 *
	 * This is intended for things like Score, Lamp, etc. Things that quite fundamentally
	 * *are* the metrics of the score.
	 */
	providedMetrics: ConfProvidedMetrics[TGame];

	/**
	 * What metrics do we want to exist on score documents, but don't need to be
	 * provided?
	 *
	 * In simple terms, all of these metrics **MUST** be derivable by a DETERMINISTIC
	 * function of f(mandatoryMetrics, chartThisScoreWasOn).
	 *
	 * This is for convenience/efficiency mainly. A good example would be "percent" for
	 * IIDX. Technically, we could recalculate it every single time we want to display
	 * it by dividing score by chart.data.notecount * 2, but that's horrendously
	 * inefficient.
	 *
	 * Furthermore, since these things are derived deterministically, they only ever
	 * need to be recalculated in extreme circumstances (an IIDX chart has changed its
	 * notecounts!!!). If mandatory metrics were to change, it's just now a different
	 * score.
	 *
	 * Another good example would be "Grade" for most games, as a grade is often just
	 * cutoffs applied on score values.
	 */
	derivedMetrics: ConfDerivedMetrics[TGame];

	/**
	 * What's the default metric for this game?
	 *
	 * This will be used to order leaderboard rankings.
	 *
	 * @note This **MUST** be one of the mandatory or derived keys.
	 */
	defaultMetric: keyof ConfDerivedMetrics[TGame] | keyof ConfProvidedMetrics[TGame];

	/**
	 * What's the preferred default enum for this game?
	 *
	 * Enum types are used across the UI (think folder breakdown charts), and the game
	 * should generally declare a default.
	 *
	 * @note This **MUST** be one of the mandatory or derived keys.
	 */
	preferredDefaultEnum: ExtractEnumMetricNames<
		ConfDerivedMetrics[TGame] & ConfProvidedMetrics[TGame]
	>;

	/**
	 * What metrics *can* we store about scores, but don't necessarily *need*?
	 *
	 * Of course, in a perfect world we'd store all the metrics always all the time!
	 * But a lot of import methods (eamusement CSV, etc) would be filtered out by
	 * mandating the existence of a lot of these metrics.
	 *
	 * The idea of additionalMetrics allow us to store useful metrics about scores
	 * without necessitating that they exist on arrival. Incredibly convenient.
	 */
	additionalMetrics: ConfOptionalMetrics[TGame];

	/**
	 * What rating algorithms may a score have attached onto it for this game?
	 *
	 * @note The implementations for these rating algorithms are handled in the
	 * server config. By defining them here, the typesystem will enforce that you
	 * implement them elsewhere.
	 */
	scoreRatingAlgs: Record<ScoreRatingAlgorithms[TGame], ScoreRatingAlgorithmConfig>;

	/**
	 * What rating algorithms may a session have attached onto it for this game?
	 *
	 * @note The implementations for these rating algorithms are handled in the
	 * server config. By defining them here, the typesystem will enforce that you
	 * implement them elsewhere.
	 */
	sessionRatingAlgs: Record<SessionRatingAlgorithms[TGame], RatingAlgorithmConfig>;

	/**
	 * What rating algorithms may a profile have attached onto it for this game?
	 *
	 * @note This is **SPECIFICALLY** for numeric, calculatable metrics. This means
	 * that the metric *must* be calculatable *at all times* from the set of all
	 * scores this user has on this game.
	 *
	 * This is intended for numeric, continous data.
	 * If you want to store something with a fixed set of values, such as a user's
	 * "rating colour", use `supportedClasses`.
	 *
	 * If you want to store something that cannot be derived from the user's scores,
	 * such as their "Dan", use `supportedClasses`.
	 *
	 * @note The implementations for these rating algorithms are handled in the
	 * server config. By defining them here, the typesystem will enforce that you
	 * implement them elsewhere.
	 */
	profileRatingAlgs: Record<ProfileRatingAlgorithms[TGame], ProfileRatingAlgorithmConfig>;

	/**
	 * What classes may a profile have attached onto it for this game?
	 *
	 * Classes are a *fixed*, *ordered* set of values.
	 * They may be a function of existing state (like "rating colours", where a user
	 * gets a new discrete colour when they go up certain ratings),
	 * or they may be provided by score imports, such as "dans", which cannot be
	 * derived from a player's scores or profile ratings.
	 */
	classes: ClassConfigs[TGame];

	/**
	 * What's the default score rating algorithm for this game?
	 *
	 * @note This should be one of the keys in scoreRatingAlgs.
	 */
	defaultScoreRatingAlg: ScoreRatingAlgorithms[TGame];

	/**
	 * What's the default session rating algorithm for this game?
	 *
	 * @note This should be one of the keys in sessionRatingAlgs.
	 */
	defaultSessionRatingAlg: SessionRatingAlgorithms[TGame];

	/**
	 * What's the default profile rating algorithm for this game?
	 *
	 * @note This should be one of the keys in sessionRatingAlgs.
	 */
	defaultProfileRatingAlg: ProfileRatingAlgorithms[TGame];

	/**
	 * How does this game handle difficulties?
	 *
	 * "Difficulties" are used to allow one song to have multiple charts. Some games
	 * may have a known set of possible difficulties, such as "Easy", "Normal" and
	 * "Hard".
	 *
	 * Other games may have an unknown set of possible difficulties, such as osu!
	 * allowing any string (as long as its unique.)
	 *
	 */
	difficulties: DifficultyConfigs[TGame];

	/**
	 * What judgements does this game have? These are typically timing-window names.
	 *
	 * These should be ordered from **best to worst**.
	 */
	orderedJudgements: ReadonlyArray<Judgements[TGame]>;

	/**
	 * What versions do we support for this game?
	 *
	 * The keys are the version names, and the values are a humanised, prettified
	 * form for them.
	 *
	 * Version are the way tachi disambiguates cases (typically in arcade games) where
	 * a chart is modified.
	 * For example, Rising in the Sun
	 * (https://remywiki.com/Rising_in_the_Sun(original_mix))
	 * was removed in IIDX 21, and revived in IIDX 27 with entirely different
	 * charts. Although these charts are completely different,
	 * they use the same song and difficulty
	 * so Rising in the Sun SP ANOTHER could mean two things!.
	 *
	 * We need to handle these cases, so we disambiguate by attaching "chart sets" onto
	 * every chart. These "chart sets" indicate what sets of chart states they
	 * appeared in for this game. Then, when a score is coming in, it can indicate what
	 * version this score was on. That way, we can make sure they resolve to the right
	 * chart.
	 */
	versions: Record<Versions[TGame], string>;

	/**
	 * Chart documents get their own game-specific record that they use for whatever
	 * they want. IIDX documents store BPI information like kaiden averages, BMS
	 * charts store sha256/md5 hashes, etc.
	 *
	 * This is a zod schema that can be used to validate that input.
	 */
	chartData: ZodObject;

	/**
	 * This is a zod schema that can be used to validate provided game-specific
	 * preferences.
	 */
	preferences: ZodObject;

	/**
	 * What game-specific metadata should be stored on scores for this game?
	 *
	 * These are for things like what options were used (RANDOM, MIRROR etc.)
	 * and don't exist on PBs.
	 */
	scoreMeta: ZodObject;

	/**
	 * What "matchTypes" should this game support for batch-manual imports? This
	 * allows us to disable things like "songTitle" resolutions for games like BMS,
	 * where song titles are absolutely not guaranteed to be unique.
	 */
	supportedMatchTypes: ReadonlyArray<MatchTypes>;
}

// Games that are BMS-like.
export type BMSGames = GamesForGroup["bms" | "pms"];
