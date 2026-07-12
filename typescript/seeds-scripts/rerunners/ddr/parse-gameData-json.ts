import { Command } from "commander";
import fs from "fs";

import { type Music, parseGameData } from "./parse-gameData";

interface JsonMusic {
	mcode: number;
	basename: string;
	title: string;
	title_sort: string;
	artist: string;
	bpmmax: number;
	bpmmin: number;
	level_str: string;
	editable: boolean;
	seriesid: number;
	ac_seriesid: number;
	limited_cha: number;
	bemaniflag: number;
}

function jsonMusicToMusic(jsonMusic: JsonMusic): Music {
	return {
		mcode: jsonMusic.mcode,
		basename: jsonMusic.basename,
		title: jsonMusic.title,
		title_yomi: jsonMusic.title_sort,
		artist: jsonMusic.artist,
		bpmmax: jsonMusic.bpmmax,
		series: jsonMusic.ac_seriesid,
		bemaniflag: jsonMusic.bemaniflag,
		limited_cha: jsonMusic.limited_cha,
		diffLv: jsonMusic.level_str,
	};
}

const program = new Command();
program.requiredOption("-i, --input <musicdb.xml>");
program.requiredOption("-v, --version <the version this mdb is for, a3, world, konaste, etc.>");

program.parse(process.argv);
const options = program.opts();

const gameData = JSON.parse(fs.readFileSync(options.input, "utf-8")).map(jsonMusicToMusic);

parseGameData(options.version, gameData);
