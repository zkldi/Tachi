import type { GameGroupFromGame, integer, LEGACY_Playtypes, V3Game } from "../types";
import type {
	ConfOptionalMetrics,
	ConfProvidedMetrics,
	Difficulties,
	ExtractedClasses,
	Judgements,
	ScoreMeta,
	Versions,
} from "./game-config";
import type { MongoExtractMetrics } from "./metrics";
import type { AllFieldsNullableOptional } from "./utils";

// These MatchTypes don't need `difficulty` set in the batch manual.
type MatchTypesNoDifficulty =
	| "bmsChartHash"
	| "gcmInGameIDSpecialChart"
	| "itgChartHash"
	| "popnChartHash"
	| "uscChartHash";

// These MatchTypes need `difficulty` set in the batch manual.
type MatchTypesWithDifficulty =
	| "ddrSongHash"
	| "inGameID"
	| "inGameStrID"
	| "sdvxInGameID"
	| "songTitle"
	| "tachiSongID";

export type MatchTypes = MatchTypesNoDifficulty | MatchTypesWithDifficulty;

interface MatchTypeBase {
	game: V3Game;
	version: Versions[V3Game] | null;
	identifier: string;
	artist?: string | null;
}

export type MatchTypeResolverWithDifficulty = {
	difficulty: string;
	matchType: MatchTypesWithDifficulty;
} & MatchTypeBase;

export type MatchTypeResolverNoDifficulty = {
	matchType: MatchTypesNoDifficulty;
} & MatchTypeBase;

export type MatchTypeResolver = MatchTypeResolverNoDifficulty | MatchTypeResolverWithDifficulty;

export type BatchManualScore<TGame extends V3Game = V3Game> = {
	artist?: string | null;
	comment?: string | null;
	/**
	 * @deprecated Use `optional` instead.
	 */
	hitMeta?: AllFieldsNullableOptional<MongoExtractMetrics<ConfOptionalMetrics[TGame]>>;
	identifier: string;
	judgements?: Record<Judgements[TGame], integer>;
	optional?: AllFieldsNullableOptional<MongoExtractMetrics<ConfOptionalMetrics[TGame]>>;

	scoreMeta?: Partial<ScoreMeta[TGame]>;
	timeAchieved?: number | null;
} & (
	| {
			difficulty: Difficulties[TGame];
			matchType: MatchTypesWithDifficulty;
	  }
	| {
			difficulty?: undefined; // hack to stop ts from screaming when this is accessed sometimes
			matchType: MatchTypesNoDifficulty;
	  }
) &
	MongoExtractMetrics<ConfProvidedMetrics[TGame]>;

export type BatchManualMeta<TGame extends V3Game = V3Game> =
	| {
			game: GameGroupFromGame[TGame];
			playtype: LEGACY_Playtypes[GameGroupFromGame[TGame]];
			service: string;
			version?: Versions[TGame];
	  }
	| {
			game: TGame;
			service: string;
			version?: Versions[TGame];
	  };

export interface BatchManual<TGame extends V3Game = V3Game> {
	meta: BatchManualMeta<TGame>;
	scores: Array<BatchManualScore<TGame>>;
	classes?: ExtractedClasses[TGame] | null;
}
