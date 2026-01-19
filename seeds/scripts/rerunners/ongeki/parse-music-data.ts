// usage: cd rerunners && npx ts-node ongeki/parse-music-data.ts

import { CreateChartID, ReadCollection, WriteCollection } from "../../util";
import { ChartDocument, Difficulties, SongDocument } from "tachi-common";
import fs from "fs/promises";

type OngekiChart = ChartDocument<"ongeki:Single">;
type OngekiSong = SongDocument<"ongeki">;
type Difficulty = Difficulties["ongeki:Single"];

const CURRENT_VERSION = "refresh";
const CURRENT_OMNIMIX = "refreshOmni";
const DRY_RUN = false;
const SOURCE = "ongeki/music.json";

interface Input {
	dataVersion: string;
	music: InputSong[];
}

interface InputSong {
	id: number;
	name: string;
	artist: string;
	genre: string;
	releaseVersion: string;
	isOmnimix: boolean;
	isReMaster: boolean;
	charts: InputChart[];
}

interface InputChart {
	difficulty: Difficulty;
	level: string;
	internalLevel: string;
	platinumScoreMax: number;
}

interface Changes {
	songs: string[];
	charts: string[];
	versions: string[];
	rerates: string[];
	renames: string[];
}

const convertLevel = (chart: InputChart) => {
	let res = `${parseInt(chart.level.slice(5), 10)}`;
	if (chart.level.endsWith("P")) {
		res += "+";
	}
	return res;
};

const updateChart = (out: OngekiChart, input: InputChart, song: InputSong, changes: Changes) => {
	const diff = song.isReMaster ? "Re:MASTER" : input.difficulty;

	if (out.levelNum !== parseFloat(input.internalLevel)) {
		changes.rerates.push(`${song.name} ${diff}: ${out.levelNum} -> ${input.internalLevel}`);
		out.level = convertLevel(input);
		out.levelNum = parseFloat(input.internalLevel);
	}

	if (!out.versions.includes(CURRENT_VERSION) && !song.isOmnimix) {
		changes.versions.push(`${song.name} ${diff}: ${CURRENT_VERSION}`);
		out.versions.push(CURRENT_VERSION);
	} else if (out.versions.includes(CURRENT_VERSION) && song.isOmnimix) {
		changes.versions.push(`${song.name} ${diff}: -${CURRENT_VERSION}`);
		out.versions = out.versions.filter((v) => v !== CURRENT_VERSION);
	}
	if (!out.versions.includes(CURRENT_OMNIMIX)) {
		changes.versions.push(`${song.name} ${diff}: ${CURRENT_OMNIMIX}`);
		out.versions.push(CURRENT_OMNIMIX);
	}

	if (input.difficulty === "LUNATIC") {
		out.data.isReMaster = song.isReMaster;
	}
};

const main = async () => {
	const charts: OngekiChart[] = ReadCollection("charts-ongeki.json");
	const songs: OngekiSong[] = ReadCollection("songs-ongeki.json");

	const input: Input = JSON.parse((await fs.readFile(SOURCE)).toString());

	console.log(`Parsing ${SOURCE} ${input.dataVersion}`);

	const changes: Changes = {
		songs: [],
		charts: [],
		versions: [],
		rerates: [],
		renames: [],
	};

	for (const inputSong of input.music) {
		if (inputSong.id === 1) {
			// Tutorial
			continue;
		}

		const anyChart = charts.find((c) => c.data.inGameID === inputSong.id);
		let song: OngekiSong | undefined;

		if (anyChart === undefined) {
			song = songs.find((s) => s.title === inputSong.name && s.artist === inputSong.artist);
			if (song === undefined) {
				song = {
					id: songs[songs.length - 1]!.id + 1,
					altTitles: [],
					searchTerms: [],
					artist: inputSong.artist,
					data: {
						genre: inputSong.genre as any,
					} as any,
					title: inputSong.name,
				};
				changes.songs.push(song.title);
				songs.push(song);
			}
		} else {
			const existingSong = songs.find((s) => s.id === anyChart.songID);

			if (existingSong === undefined) {
				throw new Error(`Song with id ${anyChart.songID} doesn't exist, but it should`);
			}
			if (existingSong.title !== inputSong.name) {
				changes.renames.push(`${existingSong.title} -> ${inputSong.name}`);
				existingSong.title = inputSong.name;
			}
			if (existingSong.artist !== inputSong.artist) {
				changes.renames.push(`${existingSong.artist} -> ${inputSong.artist}`);
				existingSong.artist = inputSong.artist;
			}

			song = existingSong;
		}

		for (const inputChart of inputSong.charts) {
			let chart = charts.find(
				(c) => c.songID === song!.id && c.difficulty === inputChart.difficulty
			);
			if (chart !== undefined) {
				updateChart(chart, inputChart, inputSong, changes);
			} else {
				let ver = inputSong.releaseVersion;
				if (!ver.startsWith("オンゲキ")) {
					ver = `オンゲキ ${ver}`;
				}
				chart = {
					chartID: CreateChartID(),
					songID: song.id,
					data: {
						displayVersion: ver as any,
						inGameID: inputSong.id,
						maxPlatScore: inputChart.platinumScoreMax,
					},
					difficulty: inputChart.difficulty,
					isPrimary: true,
					level: convertLevel(inputChart),
					levelNum: parseFloat(inputChart.internalLevel),
					playtype: "Single",
					versions: [CURRENT_VERSION, CURRENT_OMNIMIX],
				};
				if (chart.difficulty === "LUNATIC") {
					chart.data.isReMaster = inputSong.isReMaster;
				}
				changes.charts.push(`${song.title} ${chart.difficulty} ${chart.level}`);
				charts.push(chart);
			}
		}
	}

	await fs.writeFile("parse-music-data-output.json", JSON.stringify(changes, null, 4));
	console.log("Changes written to parse-music-data-output.json");

	if (!DRY_RUN) {
		WriteCollection("songs-ongeki.json", songs);
		WriteCollection("charts-ongeki.json", charts);
	}
};

main();
