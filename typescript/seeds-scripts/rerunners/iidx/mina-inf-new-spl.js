import { CreateChartID, MutateCollection } from "../../util.js";

const inGameID = 25021;
const tachiSongID = 1728;

const newCharts = [
	["SP", "LEGGENDARIA", 1903, 12],
	["DP", "LEGGENDARIA", 1861, 12],
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
				bpiCoefficient: null,
				hashSHA256: null,
				inGameID,
				kaidenAverage: null,
				notecount,
				worldRecord: null,
			},
			difficulty,
			isPrimary: true,
			level: level.toString(),
			levelNum: level,
			playtype,
			songID: tachiSongID,
			versions: ["inf"],
		});
	}

	return charts;
});
