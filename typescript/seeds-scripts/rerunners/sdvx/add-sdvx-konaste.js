import { Command } from "commander";
import Encoding from "encoding-japanese";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";

import { CreateChartID, CreateSongID, ReadCollection, WriteCollection } from "../../util.js";

const VERSIONS = {
	1: "booth",
	2: "inf",
	3: "gw",
	4: "heaven",
	5: "vivid",
	6: "exceed",
	7: "nabla",
};

const VERSION_DIFFICULTIES = {
	2: "INF",
	3: "GRV",
	4: "HVN",
	5: "VVD",
	6: "XCD",
};

const DIFFICULTIES = {
	advanced: "ADV",
	exhaust: "EXH",
	maximum: "MXM",
	novice: "NOV",
};

const SHITTY_SJIS_OVERRIDE_TITLES = {
	1724: "Verstärkt Killer",
};

function randomHex(bytes) {
	const buf = new Uint8Array(bytes);
	globalThis.crypto.getRandomValues(buf);
	return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getDifficulty(diffKey, version) {
	if (diffKey === "infinite") {
		return VERSION_DIFFICULTIES[version];
	}

	return DIFFICULTIES[diffKey];
}

function getTitle(id, title) {
	return SHITTY_SJIS_OVERRIDE_TITLES[id] || title;
}

const program = new Command();
program.option("-f, --file <XML File>");
program.parse(process.argv);
const options = program.opts();

const parser = new XMLParser({ ignoreAttributes: false });
const fileString = Encoding.convert(fs.readFileSync(options.file), {
	from: "SJIS",
	to: "UNICODE",
	type: "string",
});
const xmlData = parser.parse(fileString);

const songs = ReadCollection("songs-sdvx.json");
const charts = ReadCollection("charts-sdvx.json");

let versionAddedCount = 0;
let newChartCount = 0;

let nextLegacySongID = songs.reduce((m, s) => Math.max(m, s.legacySongID), 0) + 1;

for (const music of xmlData.mdb.music) {
	const id = Number(music["@_id"]);

	const chart = charts.find((chart) => chart.data.inGameID === id);
	let song;
	const isNewSong = !chart;
	if (isNewSong) {
		console.log(`New song ${getTitle(id, music.info.title_name)}`);
		const newSong = {
			altTitles: [],
			artist: music.info.artist_name,
			data: {
				displayVersion: VERSIONS[music.info.version["#text"]],
			},
			id: CreateSongID(),
			legacySongID: nextLegacySongID++,
			searchTerms: [music.info.ascii.replaceAll("_", " "), music.info.title_yomigana],
			title: getTitle(id, music.info.title_name),
		};
		songs.push(newSong);
		song = newSong;
	} else {
		song = songs.find((song) => song.id === chart.songID);
	}

	for (const diffKey in music.difficulty) {
		const diffData = music.difficulty[diffKey];
		const levelNum = Number(diffData.difnum["#text"]);
		if (levelNum === 0) {
			continue;
		}

		const difficulty = getDifficulty(diffKey, music.info.inf_ver["#text"]);

		const chartIndex = charts.findIndex(
			(chart) => chart.data.inGameID === id && chart.difficulty === difficulty,
		);
		if (chartIndex === -1) {
			charts.push({
				data: {
					inGameID: id,
				},
				difficulty,
				id: CreateChartID(),
				isPrimary: true,
				legacyChartID: randomHex(20),
				level: levelNum.toString(),
				levelNum,
				songID: song.id,
				versions: ["konaste"],
			});

			if (!isNewSong) {
				console.log(`New ${difficulty} ${levelNum} for song id ${id}`);
			}

			newChartCount++;
		} else if (!charts[chartIndex].versions.includes("konaste")) {
			charts[chartIndex].versions.push("konaste");

			versionAddedCount++;
		}
	}
}

console.log(`Added "konaste" version to ${versionAddedCount} charts.`);
console.log(`Added ${newChartCount} brand new charts.`);

WriteCollection("songs-sdvx.json", songs);
WriteCollection("charts-sdvx.json", charts);
