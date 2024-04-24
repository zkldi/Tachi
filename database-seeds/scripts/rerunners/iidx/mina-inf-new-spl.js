const { MutateCollection, CreateChartID } = require("../../util");

const inGameID = 80017;
const tachiSongID = 2088;

const newCharts = [
	["SP", "LEGGENDARIA", 1835, 12],
	["DP", "LEGGENDARIA", 1974, 12],
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
