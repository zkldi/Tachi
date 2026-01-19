const { Command } = require("commander");
const fs = require("fs");
const {
	CreateChartID,
	GetFreshSongIDGenerator,
	MutateCollection,
	ReadCollection,
} = require("../../util");

const getNewSongID = GetFreshSongIDGenerator("wacca");
const waccaDiffIndex = ["NORMAL", "HARD", "EXPERT", "INFERNO"];

const program = new Command();
program
	.option("-d, --data <path of json from webui>")
	.option("-t, --timeframe <date from where to start parsing>"); // don't use this unless you know what you're doing
program.parse(process.argv);
const options = program.opts();

if (!options.data) {
	throw new Error("JSON from the webui is required.");
}
let songdata = JSON.parse(fs.readFileSync(options.data).toString());

if (options.timeframe) {
	const timeframe = Date.parse(options.timeframe);
	songdata = songdata.filter((song) => Date.parse(song.releaseDate) >= timeframe);
}

const newSongs = [];
const newCharts = [];

const existingChartDocs = ReadCollection("charts-wacca.json");
const inGameIDToSongIDMap = new Map();

for (const chart of existingChartDocs) {
	inGameIDToSongIDMap.set(chart.data.inGameID, chart.songID);
}

for (const song of songdata) {
	if (!inGameIDToSongIDMap.has(song.id)) {
		// new song, add songdoc and all charts.
		console.log(`Found new song : ${song.artist} - ${song.title}`);
		const songDoc = {
			title: song.title,
			artist: song.artist,
			searchTerms: [],
			altTitles: song.titleEnglish ? [song.titleEnglish] : [],
			id: getNewSongID(),
			data: {
				displayVersion: "plus",
				genre: song.category,
			},
		};
		let diffIndex = 0;
		for (const chart of song.sheets) {
			const isPlus = (chart.difficulty * 10) % 10 >= 7;
			const chartDoc = {
				chartID: CreateChartID(),
				songID: songDoc.id,
				difficulty: waccaDiffIndex[diffIndex],
				isPrimary: true,
				level: `${Math.trunc(chart.difficulty)}${isPlus ? "+" : ""}`,
				levelNum: chart.difficulty,
				versions: ["plus"],
				playtype: "Single",
				data: {
					inGameID: song.id,
				},
			};
			newCharts.push(chartDoc);
			diffIndex += 1;
		}
		newSongs.push(songDoc);
	} else {
		// check if a new chart has been added to existing song
		const chartsForSong = existingChartDocs.filter((chart) => chart.data.inGameID === song.id);
		if (song.sheets.length > chartsForSong.length) {
			let diffIndex = 0;
			for (const chart of song.sheets) {
				if (!chartsForSong.find((existing) => existing.levelNum === chart.difficulty)) {
					console.log(
						`Found new ${waccaDiffIndex[diffIndex]} for ${song.artist} - ${song.title}`
					);
					const isPlus = (chart.difficulty * 10) % 10 >= 7;
					newCharts.push({
						chartID: CreateChartID(),
						songID: chartsForSong[0].songID,
						difficulty: waccaDiffIndex[diffIndex],
						isPrimary: true,
						level: `${Math.trunc(chart.difficulty)}${isPlus ? "+" : ""}`,
						levelNum: chart.difficulty,
						versions: ["plus"],
						playtype: "Single",
						data: {
							inGameID: song.id,
						},
					});
				}
				diffIndex += 1;
			}
		}
	}
}

MutateCollection("songs-wacca.json", (songs) => [...songs, ...newSongs]);
MutateCollection("charts-wacca.json", (charts) => [...charts, ...newCharts]);

MutateCollection("charts-wacca.json", (charts) => {
	for (const song of songdata) {
		const chartsForSong = charts.filter((chart) => chart.data.inGameID === song.id);
		for (let diffIndex = 0; diffIndex < song.sheets.length; diffIndex++) {
			const newChart = song.sheets[diffIndex];
			if (!chartsForSong.find((existing) => existing.levelNum === newChart.difficulty)) {
				console.log(
					`Found rerate on ${waccaDiffIndex[diffIndex]} for ${song.artist} - ${song.title}`
				);
				const isPlus = (newChart.difficulty * 10) % 10 >= 7;
				const oldChart = chartsForSong.find(
					(existing) =>
						existing.songID === chartsForSong[0].songID &&
						existing.difficulty === waccaDiffIndex[diffIndex]
				);
				for (const chart of charts) {
					if (chart.chartID === oldChart.chartID) {
						console.log(`Changing from ${chart.levelNum} to ${newChart.difficulty}`);
						chart.level = `${Math.trunc(newChart.difficulty)}${isPlus ? "+" : ""}`;
						chart.levelNum = newChart.difficulty;
						break;
					}
				}
			}
		}
	}
	return charts;
});
