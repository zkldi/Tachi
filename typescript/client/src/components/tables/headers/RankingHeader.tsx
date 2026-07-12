import { type SetState } from "#types/react";
import { NumericSOV } from "#util/sorts";
import { type PBScoreDocument } from "tachi-common";

import { type RankingViewMode } from "../cells/RankingCell";
import SelectableRanking from "../components/SelectableRanking";
import { type Header, type ZTableTHProps } from "../components/TachiTable";

export function CreateRankingHeader<T>(
	rankingViewMode: RankingViewMode,
	setRankingViewMode: SetState<RankingViewMode>,
	kMapToRankingData: (k: T) => PBScoreDocument["rankingData"] | undefined,
): Header<T> {
	return [
		"Site Ranking",
		"Site Ranking",

		NumericSOV((x) => {
			const rankingData = kMapToRankingData(x);

			if (!rankingData) {
				return -Infinity;
			}

			return rankingData.rank;
		}),
		(thProps: ZTableTHProps) => (
			<SelectableRanking
				rankingViewMode={rankingViewMode}
				setRankingViewMode={setRankingViewMode}
				{...thProps}
			/>
		),
	];
}
