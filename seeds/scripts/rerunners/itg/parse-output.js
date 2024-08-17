const { Command } = require("commander");
const { readFileSync } = require("fs");
const {
	ReadCollection,
	GetFreshSongIDGenerator,
	CreateChartID,
	MutateCollection,
	WriteCollection,
} = require("../../util");

const program = new Command();
program.requiredOption("-i, --input <file.json>");
program.option(
	"-e, --ecsRule",
	"Parse this using ECS rules, i.e. turning '[12] [120] Song' into the actual song title."
);
program.requiredOption("-p, --pack <Pack Name>", "What pack is this from?");

program.parse(process.argv);
const options = program.opts();

const content = JSON.parse(readFileSync(options.input));

const existingSongs = ReadCollection("songs-itg.json");
const existingCharts = ReadCollection("charts-itg.json");

const artistTitleMap = new Map();
for (const song of existingSongs) {
	// lets just hope nobody ever has \0 in their artist or title lol
	artistTitleMap.set(`${song.title}\0${song.artist}\0${song.data.subtitle}`, song);
}

const existingChartIDs = new Map();
for (const ch of existingCharts) {
	existingChartIDs.set(ch.data.hashGSv3, ch);
}

const getFreshID = GetFreshSongIDGenerator("itg");

const newCharts = [];
const newSongs = [];

for (const d of content) {
	let title;
	let difficultyTag;

	if (options.ecsRule) {
		// parses
		// [16] [160] Song Title (Hard)
		// into a real form
		// but obviously dont parse
		// [16] [160] Song Title (Restep)
		// into assuming Restep is a difficulty name
		// lil b was right
		const strippedTitle = d.meta.title.match(
			/^\[\d+\] \[\d+\] (.+?)(?: \((Beginner|Easy|Normal|Hard|Edit)\))?$/u
		);

		const [_, parsedTitle, weirdDiff] = strippedTitle;

		title = parsedTitle;

		if (weirdDiff) {
			difficultyTag = weirdDiff;
		}
	} else {
		title = d.meta.title;
	}

	const song = {
		title,
		artist: d.meta.artist,
		data: {
			subtitle: d.meta.subtitle,
		},
		searchTerms: [],
		altTitles: [],
	};

	const songExists = artistTitleMap.get(`${title}\0${song.artist}\0${song.data.subtitle}`);

	song.id = songExists ? songExists.id : getFreshID();

	if (!songExists) {
		newSongs.push(song);
	}

	for (const chart of d.charts) {
		if (!difficultyTag || d.charts.length > 1) {
			difficultyTag = chart.difficultyTag;
		}

		const rankedLevel = options.ecsRule ? Number(chart.level) : null;
		const chartLevel = Number(chart.level);

		// leading space into a number is likely a breakdown. remove it.
		const author = chart.credit.replace(/ \(?[1-9].*$/u, "");

		if (difficultyTag === "Challenge") {
			difficultyTag = "Expert";
		}

		const newChart = {
			chartID: CreateChartID(),
			songID: song.id,
			level: "?",
			levelNum: 0, // do not use, should b removed
			isPrimary: true,
			difficulty: chart.hashGSv3,
			playtype: "Stamina",
			versions: [],
			data: {
				rankedLevel,
				chartLevel,
				streamBPM: chart.streamBPM,
				breakdown: chart.breakdown,
				length: chart.length,
				difficultyTag,
				hashGSv3: chart.hashGSv3,
				notesPerMeasure: chart.notesPerMeasure,
				npsPerMeasure: chart.npsPerMeasure,
				originalPack: options.pack,
				packs: [options.pack],
				bannerLocationOverride: null,
				charter: author,
			},
		};

		if (existingChartIDs.has(chart.hashGSv3)) {
			const ch = existingChartIDs.get(chart.hashGSv3);

			ch.data.breakdown = newChart.data.breakdown;

			if (ch.data.rankedLevel === null && newChart.data.rankedLevel !== null) {
				ch.data.rankedLevel = newChart.data.rankedLevel;
			}

			if (!ch.data.packs.includes(options.pack)) {
				ch.data.packs.push(options.pack);
			}

			continue;
		}

		newCharts.push(newChart);

		existingChartIDs.push(chart.hashGSv3);
	}
}

WriteCollection("charts-itg.json", [...existingCharts, ...newCharts]);
MutateCollection("songs-itg.json", (songs) => [...songs, ...newSongs]);
