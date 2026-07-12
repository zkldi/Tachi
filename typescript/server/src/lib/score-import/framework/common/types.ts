import type { Mutable } from "#utils/types";
import type {
	ConfProvidedMetrics,
	integer,
	Judgements,
	MongoOptionalMetrics,
	ScoreDocument,
	V3Game,
} from "tachi-common";
import type { MongoExtractMetrics } from "tachi-common/types/metrics";

/**
 * ScoreData, but it's just the provided metrics (and enumIndexes don't exist).
 */
export type DryScoreData<TGame extends V3Game> = {
	judgements: Partial<Record<Judgements[TGame], integer | null>>;
	optional: Mutable<MongoOptionalMetrics[TGame]>;
} & MongoExtractMetrics<ConfProvidedMetrics[TGame]>;

/**
 * An intermediate score format that will be fully filled out by
 * HydrateScore.
 */
export type DryScore<TGame extends V3Game = V3Game> = {
	scoreData: DryScoreData<TGame>;
} & Pick<
	ScoreDocument<TGame>,
	"comment" | "game" | "importType" | "scoreMeta" | "service" | "timeAchieved"
>;

export type ScoreGameMap = Partial<Record<V3Game, Array<ScoreDocument>>>;
export type ChartIDGameMap = Partial<Record<V3Game, Set<string>>>;
