const { MutateCollection, CreateChartID } = require("../../util");

const inGameID = 80052;
const tachiSongID = 2353;

const newCharts = [
	["SP", "NORMAL", 443, 5],
	["SP", "HYPER", 797, 8],
	["SP", "ANOTHER", 1160, 10],
	["DP", "NORMAL", 442, 5],
	["DP", "HYPER", 802, 8],
	["DP", "ANOTHER", 1195, 10],
];

const shouldBeDeprimaried = (c) =>
	newCharts.map((e) => `${e[0]}-${e[1]}`).includes(`${c.playtype}-${c.difficulty}`);

MutateCollection("charts-iidx.json", (charts) => {
	for (const chart of charts) {
		if (chart.data.inGameID === inGameID && shouldBeDeprimaried(chart)) {
			chart.isPrimary = false;
		}
	}

	for (const [playtype, difficulty, notecount, level] of newCharts) {
		charts.push({
			chartID: CreateChartID(),
			data: {
				"2dxtraSet": null,
				hashSHA256: null,
				inGameID,
				bpiCoefficient: null,
				kaidenAverage: null,
				worldRecord: null,
				notecount,
			},
			difficulty,
			playtype,
			isPrimary: true,
			level: level.toString(),
			levelNum: level,
			songID: tachiSongID,
			versions: ["inf"],
		});
	}

	return charts;
});
