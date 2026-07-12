import fetch from "node-fetch";
import { type ChartDocument, type Difficulties, type SongDocument } from "tachi-common";

import { CreateChartID, MutateCollection, ReadCollection, WriteCollection } from "../../util";

const CURRENT_VERSION = "luminous";
const DATA_URL = "https://chunithm.sega.jp/storage/json/music.json";

// Obtain a token from https://developer.chunirec.net/ -> ログイン -> アカウント管理 -> big purple button to issue an API key
const CHUNIREC_TOKEN = process.env.CHUNIREC_TOKEN;
if (!CHUNIREC_TOKEN) {
	throw new Error("CHUNIREC_TOKEN not found in environment variables.");
}

type ShortDifficultyNames = "adv" | "bas" | "exp" | "mas" | "ult";

const DIFFICULTY_MAP = new Map<ShortDifficultyNames, Difficulties["chunithm"]>([
	["adv", "ADVANCED"],
	["bas", "BASIC"],
	["exp", "EXPERT"],
	["mas", "MASTER"],
	["ult", "ULTIMA"],
]);

const CHUNITHM_CATCODE_MAP = new Map([
	["niconico", "2"],
	["ORIGINAL", "5"],
	["POPS & ANIME", "0"],
	["POPS&ANIME", "0"],
	["VARIETY", "6"],
	["イロドリミドリ", "7"],
	["ゲキマイ", "9"],
	["東方Project", "3"],
]);

const RELEASE_DATES = {
	chuni: new Date("2015-07-16"),
	chuniplus: new Date("2016-02-04"),
	air: new Date("2016-08-25"),
	airplus: new Date("2017-02-09"),
	star: new Date("2017-08-24"),
	starplus: new Date("2018-03-08"),
	amazon: new Date("2018-10-25"),
	amazonplus: new Date("2019-04-11"),
	crystal: new Date("2019-10-24"),
	crystalplus: new Date("2020-07-16"),
	paradise: new Date("2021-01-21"),
	paradiselost: new Date("2021-05-13"),
	new: new Date("2021-11-04"),
	newplus: new Date("2022-04-14"),
	sun: new Date("2022-10-13"),
	sunplus: new Date("2023-05-11"),
	luminous: new Date("2023-12-14"),
};

interface ChunithmSong {
	id: string;
	catname: string;
	title: string;
	artist: string;
	lev_bas: string;
	lev_adv: string;
	lev_exp: string;
	lev_mas: string;
	lev_ult: string;
	we_kanji: string;
	we_star: string;
}

interface ChunirecSong {
	meta: {
		artist: string;
		bpm: number;
		genre: string;
		id: string;
		release: string;
		title: string;
	};
	data: Record<
		Uppercase<ShortDifficultyNames>,
		{
			const: number;
			is_const_unknown: number;
			level: number;
			maxcombo: number;
		}
	>;
}

function normalizeTitle(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/ /gu, " ")
			// eslint-disable-next-line no-irregular-whitespace
			.replace(/　/gu, " ")
			// eslint-disable-next-line no-irregular-whitespace
			.replace(/ /gu, " ")
			.replace(/：/gu, ":")
			.replace(/（/gu, "(")
			.replace(/）/gu, ")")
			.replace(/！/gu, "!")
			.replace(/？/gu, "?")
			.replace(/`/gu, "'")
			.replace(/’/gu, "'")
			.replace(/”/gu, '"')
			.replace(/～/gu, "~")
	);
}

function releaseDateToVersion(date: Date): string {
	const entries = Object.entries(RELEASE_DATES);

	for (let i = 0; i < entries.length - 1; i++) {
		const versionName = entries[i]?.[0];
		const versionStartDate = entries[i]?.[1];
		const versionEndDate = entries[i + 1]?.[1];

		if (!versionName) {
			throw new Error(`Version name at index ${i} was undefined?!`);
		}

		if (!versionStartDate || !versionEndDate) {
			throw new Error(`No start date/end date was declared for version ${versionName}.`);
		}

		if (versionStartDate <= date && date < versionEndDate) {
			return versionName;
		}
	}

	const latestVersionName = entries[entries.length - 1]?.[0];
	if (!latestVersionName) {
		throw new Error(`Latest version name was undefined.`);
	}

	return latestVersionName;
}

(async () => {
	const chunithmSongs: ChunithmSong[] = await fetch(DATA_URL, {}).then((r) => r.json());
	const chunirecSongs: ChunirecSong[] = await fetch(
		`https://api.chunirec.net/2.0/music/showall.json?token=${CHUNIREC_TOKEN}&region=jp2`,
		{},
	).then((r) => r.json());

	const existingChartDocs = ReadCollection("charts-chunithm.json");

	const inGameIDToSongIDMap = new Map<number, number>();
	const existingCharts = new Map<string, ChartDocument<"chunithm">>();

	for (const chart of existingChartDocs) {
		inGameIDToSongIDMap.set(chart.data.inGameID, chart.song.id);
		existingCharts.set(`${chart.data.inGameID}-${chart.difficulty}`, chart);
	}

	const newSongs: Array<SongDocument<"chunithm">> = [];
	const newCharts: Array<ChartDocument<"chunithm">> = [];

	for (const chunithmSong of chunithmSongs) {
		const inGameID = Number(chunithmSong.id);

		// Ignore WORLD'S END entries
		if (inGameID >= 8000) {
			continue;
		}

		const chunirecSong = chunirecSongs.find(
			(s) =>
				normalizeTitle(s.meta.title) === normalizeTitle(chunithmSong.title) &&
				CHUNITHM_CATCODE_MAP.get(s.meta.genre) ===
					CHUNITHM_CATCODE_MAP.get(chunithmSong.catname),
		);
		if (!chunirecSong) {
			console.log(`could not find chunirec data for song ${chunithmSong.title}`);
			continue;
		}

		let songID = inGameIDToSongIDMap.get(inGameID);

		if (songID === undefined) {
			songID = inGameID;

			newSongs.push({
				altTitles: [],
				artist: chunithmSong.artist,
				data: {
					displayVersion: releaseDateToVersion(new Date(chunirecSong.meta.release)),
					genre: chunithmSong.catname,
				},
				id: songID,
				searchTerms: [],
				title: chunithmSong.title,
			});
		}

		for (const [shortName, difficulty] of DIFFICULTY_MAP.entries()) {
			const key: `lev_${ShortDifficultyNames}` = `lev_${shortName}`;
			const level = chunithmSong[key];
			if (!level) {
				continue;
			}

			const exists = existingCharts.get(`${inGameID}-${difficulty}`);
			const chunirecChart = chunirecSong.data[shortName.toUpperCase()];

			let levelNum = chunirecChart.level;
			if (
				chunirecChart.is_const_unknown === 0 &&
				chunirecChart.const >= chunirecChart.level
			) {
				levelNum = chunirecChart.const;
			}

			if (exists) {
				if (!exists.versions.includes(CURRENT_VERSION)) {
					exists.versions.push(CURRENT_VERSION);
				}

				exists.level = level;
				exists.levelNum = levelNum;

				continue;
			}

			newCharts.push({
				game: "chunithm" as const,
				chartID: CreateChartID(),
				data: {
					inGameID,
				},
				difficulty,
				isPrimary: true,
				level,
				levelNum,
				playtype: "Single",
				songID,
				versions: [CURRENT_VERSION],
			});
		}
	}

	MutateCollection("songs-chunithm.json", (songs: Array<SongDocument<"chunithm">>) => [
		...songs,
		...newSongs,
	]);

	// overwrite this collection instead of mutating it
	// we already know the existing chart docs and might have mutated them to
	// declare the new versions, or update chart constants.
	WriteCollection("charts-chunithm.json", [...existingChartDocs, ...newCharts]);
})();
