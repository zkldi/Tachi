import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { FindChartWithDFVersion } from "../../../finders.js";
import { ReadCollection, WriteCollection } from "../../../util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MANUAL_TITLE_MAP = {
	// Zero idea
	"Alice à la mode": "Alice à la mode",
	"Bullet Waiting for Me(James Landino remix)": "Bullet Waiting for Me (James Landino remix)",
	"Last｜Eternity": "Last | Eternity",
	"Last｜Moment": "Last | Moment",
	"MANTIS(Arcaea Ultra-Bloodrush VIP)": "MANTIS (Arcaea Ultra-Bloodrush VIP)",
	"ouroboros-twin stroke of the end-": "ouroboros -twin stroke of the end-",
	"PRAGMATISM-RESURRECTION-": "PRAGMATISM -RESURRECTION-",
	"Remind the Souls(Short Version)": "Remind the Souls (Short Version)",
	"Shades of Light ina Transcendent Realm": "Shades of Light in a Transcendent Realm",
	"Shades of Lightin a Transcendent Realm": "Shades of Light in a Transcendent Realm",
	" ͟͝͞Ⅱ́̕": " ͟͝͞Ⅱ́̕ ",
	"͟͝͞Ⅱ́̕": " ͟͝͞Ⅱ́̕ ",
	Ⅱ: " ͟͝͞Ⅱ́̕ ",
	"ハルトピア~Utopia of Spring~": "Harutopia ~Utopia of Spring~",
	"ベースラインやってる？w": "Can I Friend You on Bassbook? Lol",
	"光速神授説- Divine Light of Myriad -": "Divine Light of Myriad",
	"妖艶魔女-trappola bewitching-": "trappola bewitching",
	"緋色月下、狂咲ノ絶(nayuta 2017 ver.)": "Hiiro Gekka, Kyoushou no Zetsu (nayuta 2017 ver.)",
	// They use some fucked up delta character on wikiwiki
	"LIVHT MY W​Δ​Y": "LIVHT MY WΔY",
	"Rain of Conflictin a Radiant Abyss": "Rain of Conflict in a Radiant Abyss",
	"MEGALOVANIA(Camellia Remix)": "MEGALOVANIA (Camellia Remix)",
	"DA'AT-The First Seeker of Souls-": "DA'AT -The First Seeker of Souls-",
	"Signal feat. Such": "Signal",
	"キャラメルポップコーンたべたいよ～": "キャラメルポップコーンたべたいよ〜",
	"患部で止まってすぐ溶ける　～ 狂気の優曇華院": "患部で止まってすぐ溶ける　〜 狂気の優曇華院",
	"患部で止まってすぐ溶ける～ 狂気の優曇華院": "患部で止まってすぐ溶ける　〜 狂気の優曇華院",
};
// Multiple different songs with the same title, requiring artist search.
const NEEDS_ARTIST_SEARCH = ["Quon", "Genesis"];

const AF_FTR_BLACKLIST = [
	"Singularity VVVIP",
	"Ignotus Afterburn",
	"overdead.",
	"Red and Blue and Green",
	"0xe0e1ccull",
	"HIVEMIND INTERLINKED",
	"Live Faster Die Younger",
	"Mistempered Malignance",
];

const songs = ReadCollection("songs-arcaea.json");

function findSong(collection, ccEntry) {
	const mappedTitle = MANUAL_TITLE_MAP[ccEntry.title] ?? ccEntry.title;
	const needsArtistSearch = NEEDS_ARTIST_SEARCH.includes(ccEntry.title);

	return collection.find(
		(e) =>
			(e.title === mappedTitle || e.altTitles.includes(mappedTitle)) &&
			(!needsArtistSearch || e.artist === ccEntry.artist),
	);
}

function parseScrapedData(file, mutationCallback) {
	const charts = ReadCollection("charts-arcaea.json");

	const ccData = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf-8"));

	for (const entry of ccData) {
		if (AF_FTR_BLACKLIST.includes(entry.title) && entry.difficulty === "Future") {
			continue;
		}

		const song = findSong(songs, entry);

		if (!song) {
			console.warn(`Could not find song with title ${entry.title}`);
			continue;
		}

		const chart = FindChartWithDFVersion(charts, song.id, entry.difficulty, "mobile");

		if (!chart) {
			console.warn(`${song.title} [${entry.difficulty}] - Couldn't find chart?`);
			continue;
		}

		mutationCallback(chart, entry);
	}

	console.info(`Finished parsing ${file}`);
	WriteCollection("charts-arcaea.json", charts);
}

function chartConstantMutationCallback(chart, entry) {
	if (chart.levelNum !== entry.levelNum) {
		console.info(`${entry.title} ${entry.difficulty} ${chart.levelNum} -> ${entry.levelNum}`);
	}
	chart.level = entry.level;
	chart.levelNum = entry.levelNum;
}

if (fs.existsSync(path.join(__dirname, "lower.json"))) {
	parseScrapedData("lower.json", chartConstantMutationCallback);
}

if (fs.existsSync(path.join(__dirname, "upper.json"))) {
	parseScrapedData("upper.json", chartConstantMutationCallback);
}

if (fs.existsSync(path.join(__dirname, "notecount.json"))) {
	parseScrapedData("notecount.json", (chart, entry) => {
		if (
			chart.data.notecount !== undefined &&
			chart.data.notecount > 0 &&
			chart.data.notecount !== entry.notecount
		) {
			console.warn(
				`${entry.title} ${entry.difficulty} ${chart.notecount} -> ${entry.notecount}`,
			);
		}
		chart.data = {
			...chart.data,
			notecount: entry.notecount,
		};
	});
}
