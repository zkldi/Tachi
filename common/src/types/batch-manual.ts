import type { integer } from "../types";
import type {
	ConfOptionalMetrics,
	Versions,
	Difficulties,
	ExtractedClasses,
	GPTString,
	GPTStringToGame,
	GPTStringToPlaytype,
	Judgements,
	ConfProvidedMetrics,
	ScoreMeta,
	Playtype,
	Game,
} from "./game-config";
import type { ExtractMetrics } from "./metrics";
import type { AllFieldsNullableOptional } from "./utils";

// These MatchTypes don't need `difficulty` set in the batch manual.
type MatchTypesNoDifficulty = "bmsChartHash" | "itgChartHash" | "popnChartHash" | "uscChartHash";

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
	game: Game;
	playtype: Playtype;
	version: Versions[GPTString] | null;
	identifier: string;
	artist?: string | null;
}

export type MatchTypeResolverWithDifficulty = MatchTypeBase & {
	matchType: MatchTypesWithDifficulty;
	difficulty: string;
};

export type MatchTypeResolverNoDifficulty = MatchTypeBase & {
	matchType: MatchTypesNoDifficulty;
};

export type MatchTypeResolver = MatchTypeResolverNoDifficulty | MatchTypeResolverWithDifficulty;

export type BatchManualScore<GPT extends GPTString = GPTString> = ExtractMetrics<
	ConfProvidedMetrics[GPT]
> & {
	identifier: string;
	comment?: string | null;
	judgements?: Record<Judgements[GPT], integer>;
	timeAchieved?: number | null;
	artist?: string | null;
	optional?: AllFieldsNullableOptional<ExtractMetrics<ConfOptionalMetrics[GPT]>>;

	/**
	 * @deprecated Use `optional` instead.
	 */
	hitMeta?: AllFieldsNullableOptional<ExtractMetrics<ConfOptionalMetrics[GPT]>>;
	scoreMeta?: Partial<ScoreMeta[GPT]>;
} & (
		| {
				matchType: MatchTypesNoDifficulty;
				difficulty?: undefined; // hack to stop ts from screaming when this is accessed sometimes
		  }
		| {
				matchType: MatchTypesWithDifficulty;
				difficulty: Difficulties[GPT];
		  }
	);

export interface BatchManual<GPT extends GPTString = GPTString> {
	meta: {
		game: GPTStringToGame[GPT];
		playtype: GPTStringToPlaytype[GPT];
		service: string;
		version?: Versions[GPT];
	};
	scores: Array<BatchManualScore<GPT>>;
	classes?: ExtractedClasses[GPT] | null;
}
