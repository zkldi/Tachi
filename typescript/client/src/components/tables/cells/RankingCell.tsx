import { type integer, type PBScoreDocument } from "tachi-common";

import { rankingColumnTdStyle } from "./ranking-cell-layout";

export type RankingViewMode = "both-if-self" | "global" | "global-no-switch" | "rival";

const lineCls = "d-block";

export default function RankingCell({
	rankingData,
	userID: _userID,
	rankingViewMode: _rankingViewMode,
}: {
	rankingData: PBScoreDocument["rankingData"];
	rankingViewMode: RankingViewMode;
	userID: integer;
}) {
	const title = `#${rankingData.rank} / ${rankingData.outOf}`;
	return (
		<td style={rankingColumnTdStyle} title={title}>
			<div className={lineCls}>
				<strong>#{rankingData.rank}</strong>
				<small>/{rankingData.outOf}</small>
			</div>
		</td>
	);
}
