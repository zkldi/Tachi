// usage: cd typescript/seeds-scripts/rerunners/ongeki && bun run parse-music-data.ts

import fs from "fs/promises";
import {
	CreateSongID,
	SEEDS_ChartDocument,
	SEEDS_SongDocument,
	type Difficulties,
} from "tachi-common";
import { Command } from "commander";
import { CreateChartID, ReadCollection, WriteCollection } from "../../util";
import crypto from "crypto";

type OngekiChart = SEEDS_ChartDocument<"ongeki">;
type OngekiSong = SEEDS_SongDocument<"ongeki">;
type Difficulty = Difficulties["ongeki"];

const command = new Command()
	.requiredOption("-m, --musicjson <path-to-music-json>")
	.parse(process.argv);
const options = command.opts();

const CURRENT_VERSION = "refresh";
const CURRENT_OMNIMIX = "refreshOmni";
const DRY_RUN = false;

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
	ids: string[];
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
	if (out.data.inGameID === null) {
		changes.ids.push(`${song.name} ${diff}: ${song.id}`);
		out.data.inGameID = song.id;
	}
};

const main = async () => {
	const charts: OngekiChart[] = ReadCollection("charts-ongeki.json");
	const songs: OngekiSong[] = ReadCollection("songs-ongeki.json");

	const input: Input = JSON.parse((await fs.readFile(options.musicjson)).toString());

	console.log(`Parsing ${options.musicjson} ${input.dataVersion}`);

	const changes: Changes = {
		songs: [],
		charts: [],
		versions: [],
		rerates: [],
		renames: [],
		ids: [],
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
					id: CreateSongID(),
					legacySongID: songs[songs.length - 1]!.legacySongID + 1,
					altTitles: [],
					searchTerms: [],
					artist: inputSong.artist,
					data: {
						genre: inputSong.genre as any,
						duration: null,
					},
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
			if (inputChart.difficulty === "LUNATIC" && inputSong.isReMaster) {
				inputChart.difficulty = "Re:MASTER";
			}
			let chart = charts.find(
				(c) => c.songID === song!.id && c.difficulty === inputChart.difficulty,
			);
			if (chart !== undefined) {
				updateChart(chart, inputChart, inputSong, changes);
			} else {
				let ver = inputSong.releaseVersion;
				if (!ver.startsWith("オンゲキ")) {
					ver = `オンゲキ ${ver}`;
				}
				const newChart: OngekiChart = {
					id: CreateChartID(),
					legacyChartID: `C${crypto.randomBytes(19).toString("hex")}`,
					songID: song.id,
					data: {
						displayVersion: ver as any,
						inGameID: inputSong.id,
						maxPlatScore: inputChart.platinumScoreMax,
						isBonusTrack: inputSong.id >= 7000 && inputSong.id < 8000,
					},
					difficulty: inputChart.difficulty,
					isPrimary: true,
					level: convertLevel(inputChart),
					levelNum: parseFloat(inputChart.internalLevel),
					versions: [CURRENT_VERSION, CURRENT_OMNIMIX],
				};

				chart = newChart;
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
