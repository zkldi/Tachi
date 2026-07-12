import {
	type ChartDocument,
	type Difficulties,
	type GameGroupConfig,
	GetGameGroupConfig,
	type LEGACY_Playtypes,
	type SongDocument,
	type Versions,
} from "tachi-common";
import { DDR_FLARE_CATEGORIES } from "tachi-common/config/game-support/ddr";

import { CreateChartID, ReadCollection, WriteCollection } from "../../util";

const gameGroupConfig = GetGameGroupConfig("ddr") as GameGroupConfig<"ddr">;

export interface Music {
	mcode: number;
	basename: string;
	title: string;
	title_yomi: string;
	artist: string;
	bpmmax: number;
	series: number;
	bemaniflag: number;
	limited_cha: number;
	diffLv: string;
}

const DIFFICULTIES: Array<Difficulties["ddr-dp" | "ddr-sp"]> = [
	"BEGINNER",
	"BASIC",
	"DIFFICULT",
	"EXPERT",
	"CHALLENGE",
];

function seriesToFlareCategory(series: number) {
	if (!series) {
		return DDR_FLARE_CATEGORIES.enum.NONE;
	}
	// Before X3 vs 2nd MIX
	if (series <= 13) {
		return DDR_FLARE_CATEGORIES.enum.CLASSIC;
	}
	// Between 2013 and A
	if (series > 13 && series <= 17) {
		return DDR_FLARE_CATEGORIES.enum.WHITE;
	}
	// Between A20 and WORLD
	if (series > 17 && series <= 21) {
		return DDR_FLARE_CATEGORIES.enum.GOLD;
	}
	return DDR_FLARE_CATEGORIES.enum.NONE;
}

function buildSong(music: Music): SongDocument<"ddr"> {
	return {
		artist: `${music.artist}`,
		title: `${music.title}`,
		id: music.mcode,
		data: {
			inGameID: music.mcode,
			flareCategory: seriesToFlareCategory(music.series),
			basename: music.basename,
		},
		altTitles: [],
		searchTerms: [],
	};
}

function buildChart(
	music: Music,
	playtype: LEGACY_Playtypes["ddr"],
	difficulty: Difficulties["ddr-dp" | "ddr-sp"],
	version: Versions["ddr-dp" | "ddr-sp"],
): ChartDocument<"ddr-dp" | "ddr-sp"> {
	const splitDiff = music.diffLv.split(" ");
	const diffIndex = (playtype === "SP" ? 0 : 5) + DIFFICULTIES.indexOf(difficulty);
	const game: "ddr-dp" | "ddr-sp" = playtype === "SP" ? "ddr-sp" : "ddr-dp";
	return {
		game,
		chartID: CreateChartID(),
		songID: music.mcode,
		difficulty: difficulty,
		isPrimary: true,
		level: splitDiff[diffIndex]!,
		levelNum: parseInt(splitDiff[diffIndex]!, 10),
		playtype: playtype,
		versions: [version],
		data: {
			inGameID: music.mcode,
		},
	};
}

export function parseGameData(version: Versions["ddr-dp" | "ddr-sp"], gameData: Music[]) {
	const songs = ReadCollection("songs-ddr.json");
	const existingChartDocs = ReadCollection("charts-ddr.json");
	const existingCharts = new Map<string, ChartDocument<"ddr-dp" | "ddr-sp">>();
	for (const chart of existingChartDocs) {
		existingCharts.set(`${chart.data.inGameID}-${chart.difficulty}-${chart.playtype}`, chart);
	}

	const newSongs: SongDocument<"ddr">[] = [];
	const newCharts: ChartDocument<"ddr-dp" | "ddr-sp">[] = [];
	for (const music of gameData) {
		const song = songs.find((s: SongDocument<"ddr">) => s.data.inGameID === music.mcode);
		if (!song) {
			const newSong = buildSong(music);
			console.log(
				`New song detected: ${newSong.artist} - ${newSong.title} (inGameId ${newSong.id})`,
			);
			newSongs.push(buildSong(music));
		} else {
			song.data.basename = music.basename;
		}
		const splitDiff = music.diffLv.split(" ");
		for (let i = 0; i < 10; i++) {
			const diff = parseInt(splitDiff[i]!, 10);
			if (diff > 0 && diff <= 19) {
				const playtype = gameGroupConfig.playtypes.at(Math.floor(i / 5))!;
				const difficulty = DIFFICULTIES.at(i % 5)!;
				const exists = existingCharts.get(`${music.mcode}-${difficulty}-${playtype}`);
				if (exists) {
					if (!exists.versions.includes(version)) {
						console.log(
							`Adding version ${version} to chart ${exists.playtype} ${exists.difficulty} of song ${song.artist} - ${song.title} (inGameId ${song.id})`,
						);
						exists.versions.push(version);
					}

					exists.level = splitDiff[i]!;
					exists.levelNum = diff;
				} else {
					const newChart = buildChart(music, playtype, difficulty, version);
					console.log(
						`New chart detected: ${newChart.playtype} ${newChart.difficulty} for song ${music.artist} - ${music.title} (inGameId ${music.mcode})`,
					);
					newCharts.push(newChart);
				}
			}
		}
	}

	// overwrite the collections instead of mutating them
	// we already know the existing docs and might have mutated them to
	// declare the new versions, or update constants.

	WriteCollection("songs-ddr.json", [...songs, ...newSongs]);
	WriteCollection("charts-ddr.json", [...existingChartDocs, ...newCharts]);
}
