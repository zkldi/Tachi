import { Command } from "commander";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import { decode } from "iconv-lite";
import { CreateChartID, CreateSongID } from "tachi-common";

import { ReadCollection, WriteCollection } from "../../util.js";
import { InsaneCharRebinds } from "./chars.js";

const program = new Command();
program.requiredOption("-i, --input <music_db.xml>");
program.parse(process.argv);
const options = program.opts();

const VERSION = "nabla";

type XMLText<T> = { "#text": T };

type MDBChart = { difnum: XMLText<number> };

type MDBEntry = {
	info: {
		artist_name: string;
		ascii: string;
		title_name: string;
		title_yomigana: string;
		version: XMLText<number>;
		inf_ver?: XMLText<number>;
	};
	difficulty: Partial<{
		novice: MDBChart;
		advanced: MDBChart;
		exhaust: MDBChart;
		infinite: MDBChart;
		maximum: MDBChart;
		ultimate: MDBChart;
	}>;
	"@_id": string;
};

type SeedSong = {
	altTitles: string[];
	artist: string;
	data: { displayVersion: string };
	id: string;
	legacySongID: number;
	searchTerms: string[];
	title: string;
};

type SeedChart = {
	data: { inGameID: number; clearTier?: unknown; pucTier?: unknown; sTier?: unknown };
	difficulty: string;
	id: string;
	isPrimary: boolean;
	legacyChartID: string;
	level: string;
	levelNum: number;
	songID: string;
	versions: string[];
};

const blacklist = new Set([1259, 1491, 1438, 1490]);

function fixString(s: string): string {
	return s
		.split("")
		.map((c) => InsaneCharRebinds[c] ?? c)
		.join("");
}

function randomHex(bytes: number): string {
	const buf = new Uint8Array(bytes);
	globalThis.crypto.getRandomValues(buf);
	return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function convertVersion(input: number): string {
	const table: Record<number, string> = {
		1: "booth",
		2: "inf",
		3: "gw",
		4: "heaven",
		5: "vivid",
		6: "exceed",
		7: "nabla",
	};
	const v = table[input];
	if (!v) throw new Error(`Unknown version field ${input} in mdb.`);
	return v;
}

function convertDiff(diff: keyof MDBEntry["difficulty"], infVer: number): string {
	switch (diff) {
		case "novice":
			return "NOV";
		case "advanced":
			return "ADV";
		case "exhaust":
			return "EXH";
		case "maximum":
			return "MXM";
		case "ultimate":
			return "ULT";
		case "infinite":
			switch (infVer) {
				case 2:
					return "INF";
				case 3:
					return "GRV";
				case 4:
					return "HVN";
				case 5:
					return "VVD";
				case 6:
					return "XCD";
				case 7:
					return "NBL";
				default:
					throw new Error(`Unknown inf_ver ${infVer}.`);
			}
	}
}

const parser = new XMLParser({ ignoreAttributes: false });
const utf8 = decode(fs.readFileSync(options.input), "shift-jis");
const xml = parser.parse(utf8) as { mdb: { music: MDBEntry[] } };

const songs: SeedSong[] = ReadCollection("songs-sdvx.json");
const charts: SeedChart[] = ReadCollection("charts-sdvx.json");

const inGameIDToSongID = new Map<number, string>();
const chartByKey = new Map<string, SeedChart>();
for (const c of charts) {
	inGameIDToSongID.set(c.data.inGameID, c.songID);
	chartByKey.set(`${c.data.inGameID}-${c.difficulty}`, c);
}

let nextLegacySongID = songs.reduce((m, s) => Math.max(m, s.legacySongID), 0) + 1;

let newSongCount = 0;
let newChartCount = 0;
let versionTagCount = 0;
let levelRefreshCount = 0;

for (const entry of xml.mdb.music) {
	const inGameID = Number(entry["@_id"]);
	if (blacklist.has(inGameID)) continue;

	let songID = inGameIDToSongID.get(inGameID);
	if (songID === undefined) {
		const fixedTitle = fixString(entry.info.title_name);
		const altTitles = fixedTitle !== entry.info.title_name ? [entry.info.title_name] : [];

		const song: SeedSong = {
			altTitles,
			artist: fixString(entry.info.artist_name),
			data: { displayVersion: convertVersion(entry.info.version["#text"]) },
			id: CreateSongID(),
			legacySongID: nextLegacySongID++,
			searchTerms: [entry.info.ascii],
			title: fixedTitle,
		};
		songs.push(song);
		inGameIDToSongID.set(inGameID, song.id);
		songID = song.id;
		newSongCount++;
	}

	for (const diff of [
		"novice",
		"advanced",
		"exhaust",
		"infinite",
		"maximum",
		"ultimate",
	] as const) {
		const md = entry.difficulty[diff];
		if (!md) continue;

		const infVer = entry.info.inf_ver?.["#text"];
		if (diff === "infinite" && infVer === 0) continue;
		if (md.difnum["#text"] === 0) continue;

		const difficulty = convertDiff(diff, infVer ?? 2);

		const levelNum = md.difnum["#text"] / 10;
		const level = Number.isInteger(levelNum) ? levelNum.toString() : levelNum.toFixed(1);

		const key = `${inGameID}-${difficulty}`;
		const existing = chartByKey.get(key);
		if (existing) {
			if (!existing.versions.includes(VERSION)) {
				existing.versions.push(VERSION);
				versionTagCount++;
			}
			if (existing.levelNum !== levelNum) {
				existing.level = level;
				existing.levelNum = levelNum;
				levelRefreshCount++;
			}
			continue;
		}

		const chart: SeedChart = {
			data: { inGameID },
			difficulty,
			id: CreateChartID(),
			isPrimary: true,
			legacyChartID: randomHex(20),
			level,
			levelNum,
			songID,
			versions: [VERSION],
		};
		charts.push(chart);
		chartByKey.set(key, chart);
		newChartCount++;
	}
}

WriteCollection("songs-sdvx.json", songs);
WriteCollection("charts-sdvx.json", charts);

console.log(`new songs:           ${newSongCount}`);
console.log(`new charts:          ${newChartCount}`);
console.log(`version tag added:   ${versionTagCount}`);
console.log(`level refreshed:     ${levelRefreshCount}`);
