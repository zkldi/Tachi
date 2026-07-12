import type { BMSGames } from "tachi-common";

import GetTableData from "../fetch-tables";
import { ChunkifyPromiseAll, GetScoresForMD5 } from "../util";

export default async function FetchAllTableScores(game: BMSGames) {
	const tableInfo = await GetTableData(game);

	const promises = [];

	for (const table of tableInfo) {
		for (const chart of table.charts) {
			promises.push(() => GetScoresForMD5(chart.md5));
		}
	}

	await ChunkifyPromiseAll(promises, 100);
}

if (require.main === module) {
	void FetchAllTableScores("bms-7k");
	void FetchAllTableScores("bms-14k");
}
