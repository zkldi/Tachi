import type { GamesForGroup, PBScoreDocument } from "tachi-common";

import { LoadPbsAdjacentByChartRank } from "#lib/db-formats/pb";

export function GetAdjacentAbove(userPB: PBScoreDocument, size = 5) {
	return LoadPbsAdjacentByChartRank(
		userPB.chartID,
		userPB.rankingData.rank,
		"above",
		size,
	) as Promise<Array<PBScoreDocument<GamesForGroup["usc"]>>>;
}

export function GetAdjacentBelow(userPB: PBScoreDocument, size = 5) {
	return LoadPbsAdjacentByChartRank(
		userPB.chartID,
		userPB.rankingData.rank,
		"below",
		size,
	) as Promise<Array<PBScoreDocument<GamesForGroup["usc"]>>>;
}
