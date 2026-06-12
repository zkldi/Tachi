import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import {
	type ChartDocument,
	type MongoDerivedMetrics,
	type ScoreData,
	type V3Game,
} from "tachi-common";

import type { DryScoreData } from "../common/types";

/**
 * Create calculated data for a score.
 * @param scores - All of the scores in this session.
 */
export function CreateScoreCalcData<TGame extends V3Game>(
	scoreData: DryScoreData<TGame> | ScoreData<TGame>,
	chart: ChartDocument<TGame>,
) {
	const impl = GAME_IMPLEMENTATIONS[chart.game];

	// Union of per-game `scoreDeriver` signatures is not callable with a generic game
	// so hack here with as any.

	// derive score data and then run calc
	const derivedData = impl.scoreDeriver(
		scoreData as any,
		chart as any,
	) as MongoDerivedMetrics[TGame];

	// override generic types into concrete ones
	const scoreCalcs = impl.scoreCalcs as unknown as (
		scoreData: ScoreData<TGame>,
		derivedData: MongoDerivedMetrics[TGame],
		chart: ChartDocument<TGame>,
	) => Record<string, number | null>;

	return scoreCalcs(scoreData as ScoreData<TGame>, derivedData, chart);
}
