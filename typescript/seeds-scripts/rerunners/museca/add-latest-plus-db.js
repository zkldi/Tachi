// This imports the latest M+ database in the website's format
// available from https:// m+ website /musicdb.json

import { Command } from "commander";
import fs from "fs";
import crypto from "crypto";

import { CreateSongID, CreateChartID, ReadCollection, WriteCollection } from "../../util.js";

function Random20Hex() {
	return crypto.randomBytes(20).toString("hex");
}

const PLUS_FIRST_SONG_ID = 227;
const MUSECA_DIFFICULTIES = ["Green", "Yellow", "Red"];
const B_REV_REMOVALS = [41, 42, 171];

const program = new Command();
program.option("-v, --vanilla", "Only import data from vanilla charts.", false);
program.option("-d, --db <path to musicdb.json>", "The path to the M+ musicdb.json");
program.parse(process.argv);
const options = program.opts();

const songs = ReadCollection("songs-museca.json");
const charts = ReadCollection("charts-museca.json");

const db = JSON.parse(fs.readFileSync(options.db));

for (const music of db) {
	// 1+1/2 songs start at 27th July 2016
	// offline kit/b-rev exclusive songs have a date of 20th June 2018
	// m+ songs start at a specific song ID
	let version = "1";
	if (music.id >= PLUS_FIRST_SONG_ID) version = "m+";
	else if (music.distribution_date == 20180620) version = "1.5-b";
	else if (music.distribution_date >= 20160727) version = "1.5";
	// skip m+ songs if we're doing vanilla
	if (options.vanilla && version == "m+") continue;

	let existingSong = songs.find((song) => song.legacySongID === music.id);
	const isNewSong = !existingSong;
	if (isNewSong) {
		// add the song to the db
		songs.push({
			altTitles: [],
			data: {},
			id: CreateSongID(),
			legacySongID: music.id,
			searchTerms: [],
		});
		existingSong = songs.find((song) => song.legacySongID === music.id);
	}
	// update the existing song in the db
	existingSong.artist = music.artist;
	existingSong.data.artistJP = music.artist_yomi;
	existingSong.data.titleJP = music.title_yomi;
	existingSong.data.displayVersion = version;
	existingSong.title = music.title;

	// get an array of versions this song is playable in
	// version 1 isn't tracked by tachi so correct it to 1.5
	let versions = [version == "1" ? "1.5" : version];
	// if the song was in 1.5 and not removed in b rev then add b rev
	if (versions[0] != "m+" && !B_REV_REMOVALS.includes(music.id)) versions.push("1.5-b");
	// all songs are playable in m+
	if (!options.vanilla && !versions.includes("m+")) versions.push("m+");

	// iterate through the charts
	for (let i = 0; i < 3; i++) {
		const diff = MUSECA_DIFFICULTIES[i];
		let existingChart = charts.find(
			(charts) => charts.songID === existingSong.id && charts.difficulty == diff,
		);
		const isNewChart = !existingChart;
		if (isNewChart) {
			// add the chart to the db
			charts.push({
				data: {
					inGameID: music.id,
				},
				difficulty: diff,
				id: CreateChartID(),
				isPrimary: true,
				songID: existingSong.id,
				legacyChartID: Random20Hex(),
				versions,
			});
			existingChart = charts.find(
				(charts) => charts.songID === existingSong.id && charts.difficulty == diff,
			);
		}
		// edit the existing chart
		existingChart.versions = versions;
		existingChart.level = music.cskill_levels[i].toString();
		existingChart.levelNum = music.cskill_levels[i];
		existingChart.data.inGameID = music.id;
	}
}

WriteCollection("songs-museca.json", songs);
WriteCollection("charts-museca.json", charts);
