import { log } from "#log";
import { type ChartDocument, type Difficulties, type SongDocument } from "tachi-common";

import {
	CreateChartID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../util";

type BaseDifficulty = "adv" | "bas" | "exp" | "mas" | "remas";
type MaimaiDXDifficulty = `${"" | "dx_"}lev_${BaseDifficulty}`;

type MaimaiDXSong = {
	artist: string;
	catcode: string;
	comment?: string;
	image_url: string;
	kanji?: string;
	lev_utage?: string;
	release: string;
	sort: string;
	title: string;
	title_kana: string;
	version: string;
} & Record<MaimaiDXDifficulty, string | undefined>;

interface InternalLevelEntry {
	dx: boolean;
	lv: { remas?: number } & Record<Exclude<BaseDifficulty, "remas">, number>;
	ico: string;
}

const DATA_URL = "https://maimai.sega.jp/data/maimai_songs.json";
const INTERNAL_LEVEL_URL =
	"https://sgimera.github.io/mai_RatingAnalyzer/scripts_maimai/maidx_in_lv_buddiesplus.js";

const VERSION_OVERRIDES = {
	"INTERNET OVERDOSE": 230,
	"Knight Rider": 230,
	"Let you DIVE!": 230,
	"Trrricksters!!": 230,
	"Λzure Vixen": 240,
};
const VERSION_MAP = new Map([
	[0, null],
	[100, "maimai"],
	[110, "maimai PLUS"],
	[120, "GreeN"],
	[130, "GreeN PLUS"],
	[140, "ORANGE"],
	[150, "ORANGE PLUS"],
	[160, "PiNK"],
	[170, "PiNK PLUS"],
	[180, "MURASAKi"],
	[185, "MURASAKi PLUS"],
	[190, "MiLK"],
	[195, "MiLK PLUS"],
	[199, "FiNALE"],
	[200, "maimaiでらっくす"],
	[205, "maimaiでらっくす PLUS"],
	[210, "Splash"],
	[215, "Splash PLUS"],
	[220, "UNiVERSE"],
	[225, "UNiVERSE PLUS"],
	[230, "FESTiVAL"],
	[235, "FESTiVAL PLUS"],
	[240, "BUDDiES"],
	[245, "BUDDiES PLUS"],
	[250, "PRiSM"],
]);
const CURRENT_VERSION_NUM = 250;
const CURRENT_VERSION = "prism";
const DIFFICULTY_TO_TACHI_DIFFICULTY: Record<MaimaiDXDifficulty, Difficulties["maimaidx"]> = {
	lev_bas: "Basic",
	lev_adv: "Advanced",
	lev_exp: "Expert",
	lev_mas: "Master",
	lev_remas: "Re:Master",
	dx_lev_bas: "DX Basic",
	dx_lev_adv: "DX Advanced",
	dx_lev_exp: "DX Expert",
	dx_lev_mas: "DX Master",
	dx_lev_remas: "DX Re:Master",
} as const;

const DX_REGEX = /dx\s*:\s*([01])/u;
const LV_REGEX = /lv\s*:\s*(\[(?:-?[\d.]+\s*,?\s*)+\])/u;
const JACKET_FILENAME_REGEX = /ico\s*:\s*['"`]([0-9a-f]+)['"`]/u;

async function ParseInternalLevelData(
	url: string = INTERNAL_LEVEL_URL,
): Promise<InternalLevelEntry[]> {
	const text = await fetch(url).then((r) => r.text());
	const data: InternalLevelEntry[] = [];

	for (const line of text.split("\n")) {
		const dxMatch = line.match(DX_REGEX);
		const lvMatch = line.match(LV_REGEX);
		const jacketMatch = line.match(JACKET_FILENAME_REGEX);

		if (!dxMatch || !lvMatch || !jacketMatch) {
			continue;
		}

		const dx = Number(dxMatch[1]!);

		if (dx !== 0 && dx !== 1) {
			log.warn(`DX should be 0 or 1, found ${dxMatch[1]} in ${line}`);
			continue;
		}

		let lv: InternalLevelEntry["lv"];

		try {
			const tmp = JSON.parse(lvMatch[1]!);

			if (!Array.isArray(tmp) || tmp.some((c) => typeof c !== "number")) {
				log.warn(`lv should be an array of numbers, found ${lvMatch[1]} in ${line}`);
				continue;
			}

			if (tmp.length > 5) {
				tmp[4] = tmp.pop();
			}

			lv = {
				bas: tmp[0],
				adv: tmp[1],
				exp: tmp[2],
				mas: tmp[3],
			};

			if (tmp[4] !== 0) {
				lv.remas = tmp[4];
			}
		} catch (e) {
			log.warn(`lv should be an array of numbers, found ${lvMatch[1]} in ${line}`);
			continue;
		}

		data.push({
			dx: dx === 1,
			lv,
			ico: jacketMatch[1]!,
		});
	}

	return data;
}

async function ParseMaimaiDXDataset() {
	const songs: Array<SongDocument<"maimaidx">> = ReadCollection("songs-maimaidx.json");
	const charts: Array<ChartDocument<"maimaidx">> = ReadCollection("charts-maimaidx.json");

	const existingSongMap = new Map(songs.map((s) => [`${s.title}-${s.artist}`, s]));
	const existingChartMap = new Map(charts.map((c) => [`${c.songID}-${c.difficulty}`, c]));

	log.info(`Fetching official song information from ${DATA_URL}...`);

	const datum: Array<MaimaiDXSong> = await fetch(DATA_URL).then((r) => r.json());

	log.info(`Fetching internal level information from ${INTERNAL_LEVEL_URL}...`);

	const internalLevelData = await ParseInternalLevelData(INTERNAL_LEVEL_URL);
	const internalLevelDataMap = new Map(
		internalLevelData.map((d) => [`${d.dx ? "DX" : "ST"}-${d.ico}`, d]),
	);

	const getFreeSongID = GetFreshSongIDGenerator("maimaidx");

	for (const data of datum) {
		if (data.lev_utage) {
			continue;
		}

		const version = VERSION_OVERRIDES[data.title] ?? Number(data.version.substring(0, 3));
		const displayVersion = VERSION_MAP.get(version);

		if (version > CURRENT_VERSION_NUM) {
			// Skipping songs that are newer than currently supported version.
			log.warn(
				`Ignoring song ${data.artist} - ${data.title}, which is newer than CURRENT_VERSION_NUM.`,
			);
			continue;
		}

		if (displayVersion === null || displayVersion === undefined) {
			throw new Error(
				`Unknown version number ${version} (from ${data.version}). Update seeds/scripts/rerunners/maimaidx/parse-maimaidx-dataset.ts.`,
			);
		}

		let tachiSongID: number | undefined;

		if (data.title === "　" && data.artist === "x0o0x_") {
			tachiSongID = 959;
		} else if (data.title === "ぽっぴっぽー" && data.artist === " ") {
			tachiSongID = 154;
		} else {
			tachiSongID = existingSongMap.get(`${data.title}-${data.artist}`)?.id;
		}

		if (!tachiSongID) {
			tachiSongID = getFreeSongID();

			const songDoc: SongDocument<"maimaidx"> = {
				id: tachiSongID,
				title: data.title.trim(),
				artist: data.artist.trim(),
				searchTerms: [],
				altTitles: [],
				data: {
					genre: data.catcode.trim(),
				},
			};

			songs.push(songDoc);

			log.info(`Added new song ${songDoc.artist} - ${songDoc.title} (ID ${tachiSongID}).`);
		}

		for (const [key, difficulty] of Object.entries(DIFFICULTY_TO_TACHI_DIFFICULTY) as [
			MaimaiDXDifficulty,
			Difficulties["maimaidx"],
		][]) {
			const level = data[key];

			if (level === undefined || level.length === 0) {
				continue;
			}

			const existingChart = existingChartMap.get(`${tachiSongID}-${difficulty}`);
			const internalLevelEntry = internalLevelDataMap.get(
				`${key.startsWith("dx_") ? "DX" : "ST"}-${data.image_url.split(".")[0]}`,
			);

			const defaultLevelNum = Number(level.replace(/\+$/u, ".6"));
			let levelNum = existingChart?.levelNum ?? defaultLevelNum;

			if (internalLevelEntry) {
				const baseDifficultyKey = key.split("_").pop() as BaseDifficulty;
				const internalLevel = internalLevelEntry.lv[baseDifficultyKey];

				// Positive internal levels mean that they have been confirmed.
				if (internalLevel && internalLevel > 0) {
					levelNum = internalLevel;
				}
			}

			if (existingChart) {
				const displayName = `${data.artist} - ${data.title} [${difficulty}] (${existingChart.chartID})`;

				if (!existingChart.versions.includes(CURRENT_VERSION)) {
					existingChart.versions.push(CURRENT_VERSION);
				}

				if (existingChart.level !== level) {
					log.info(
						`Chart ${displayName} has had a level change: ${existingChart.level} -> ${level}.`,
					);
					existingChart.level = level;
					levelNum = defaultLevelNum;
				}

				if (existingChart.levelNum !== levelNum) {
					log.info(
						`Chart ${displayName} has had a levelNum change: ${existingChart.levelNum} -> ${levelNum}.`,
					);
					existingChart.levelNum = levelNum;
				}

				continue;
			}

			const chartDoc: ChartDocument<"maimaidx"> = {
				songID: tachiSongID!,
				chartID: CreateChartID(),
				game: "maimaidx",
				level,
				levelNum,
				isPrimary: true,
				difficulty,
				playtype: "Single",
				data: {
					displayVersion,
					inGameID: null,
				},
				versions: [CURRENT_VERSION],
			};

			charts.push(chartDoc);

			log.info(`Added new chart ${data.artist} - ${data.title} [${difficulty}].`);
		}
	}

	WriteCollection("charts-maimaidx.json", charts);
	WriteCollection("songs-maimaidx.json", songs);
}

ParseMaimaiDXDataset();
