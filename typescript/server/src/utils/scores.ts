import {
	type ChartDocument,
	type PBScoreDocument,
	type ScoreDocument,
	type SongDocument,
} from "tachi-common";

import { DedupeArr } from "./misc";

export function FilterChartsAndSongs(
	scores: Array<PBScoreDocument | ScoreDocument>,
	charts: Array<ChartDocument>,
	songs: Array<SongDocument>,
) {
	const chartIDs = new Set();
	const songIDs = new Set();

	for (const score of scores) {
		chartIDs.add(score.chartID);
		songIDs.add(score.songID);
	}

	// filter out irrelevant songs and charts
	return {
		songs: songs.filter((e) => songIDs.has(e.id)),
		charts: charts.filter((e) => chartIDs.has(e.chartID)),
	};
}

export function GetScoreIDsFromComposed(pb: PBScoreDocument) {
	const arr = pb.composedFrom.map((e) => e.scoreID);

	return DedupeArr(arr);
}
