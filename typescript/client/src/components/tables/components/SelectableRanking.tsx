import { type SetState } from "#types/react";

import { rankingColumnThStyle } from "../cells/ranking-cell-layout";
import { type RankingViewMode } from "../cells/RankingCell";
import SortableTH from "./SortableTH";
import { type ZTableTHProps } from "./TachiTable";

/** Rival ranking scope is temporarily disabled; header is always a single “Ranking” column. */
export default function SelectableRanking({
	rankingViewMode: _rankingViewMode,
	setRankingViewMode: _setRankingViewMode,
	changeSort,
	currentSortMode,
	reverseSort,
}: {
	rankingViewMode: RankingViewMode;
	setRankingViewMode: SetState<RankingViewMode>;
} & ZTableTHProps) {
	return (
		<SortableTH
			changeSort={changeSort}
			currentSortMode={currentSortMode}
			name="Ranking"
			reverseSort={reverseSort}
			shortName="Ranking"
			sortingName="Site Ranking"
			style={rankingColumnThStyle}
		/>
	);
}
