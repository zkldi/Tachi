import { Database } from "bun:sqlite";
import { Command } from "commander";
import fs from "fs";

import {
	CreateChartID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../util.js";

const program = new Command();
program.requiredOption("-d, --db <maps.db>");
program.requiredOption("-f, --filter <path_filter>");
program.option("--debug", "Show debug logs", false);
program.parse(process.argv);
const options = program.opts();

// Change this to see logs in the terminal
const DEBUG = options.debug;

const db = new Database(options.db, { readonly: true });
const dbRows = db.query(`SELECT * FROM Charts WHERE path LIKE '%${options.filter}%'`).all();
console.log(`Found ${dbRows.length} charts.`);

const songs = ReadCollection("songs-usc.json");
const charts = ReadCollection("charts-usc.json");
const folderIdToSongId = {};

let newSongs = 0;
let newCharts = 0;

const getFreshSongID = GetFreshSongIDGenerator("usc");

// if debug is true, console log. Else, do nothing.
const log = DEBUG ? console.log : () => undefined;

for (const chart of dbRows) {
	// Check if chart already exists by comparing hash
	const existingChart = charts.find((c) => c.data.hashSHA1 === chart.hash);
	if (existingChart) {
		log(`Chart ${chart.title} ${existingChart.difficulty} already exists.`);
		continue;
	}

	if (!folderIdToSongId[chart.folderid]) {
		const splitPath = chart.path.replaceAll("\\", "/").split("/");
		const folderName = splitPath[splitPath.length - 2];

		// this is sketchy. might have false positives/false negatives!!
		const existingSong = songs.find(
			(s) =>
				(s.title === chart.title ||
					s.searchTerms.includes(folderName) ||
					s.searchTerms.includes(folderName.replaceAll("_", " ")) ||
					s.searchTerms.includes(folderName.replaceAll(" ", "_"))) &&
				s.artist === chart.artist,
		);

		if (existingSong) {
			log(`Song ${folderName} already exists with id ${existingSong.id}.`);
			folderIdToSongId[chart.folderid] = existingSong.id;
		} else {
			const songID = getFreshSongID();

			songs.push({
				altTitles: [],
				artist: chart.artist,
				data: {},
				id: songID,
				searchTerms: [folderName],
				title: chart.title,
			});

			folderIdToSongId[chart.folderid] = songID;
			newSongs++;
			log(`Added song ${songID} for folder ${folderName}.`);
		}
	}

	const songID = folderIdToSongId[chart.folderid];

	for (const playtype of ["Controller", "Keyboard"]) {
		charts.push({
			chartID: CreateChartID(),
			data: {
				effector: chart.effector,
				hashSHA1: chart.hash,
				isOfficial: true,
				tableFolders: [],
			},
			difficulty: chart.diff_shortname,
			isPrimary: true,
			level: chart.level.toString(),
			levelNum: chart.level,
			playtype,
			songID,
			versions: [],
		});
	}

	newCharts++;

	log(`Added chart ${chart.title} ${chart.diff_shortname}.`);
}

console.log(`Added ${newSongs} new songs and ${newCharts} new charts.`);

WriteCollection("songs-usc.json", songs);
WriteCollection("charts-usc.json", charts);
