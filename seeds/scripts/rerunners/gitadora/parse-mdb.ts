import { Command } from "commander";
import { XMLParser } from "fast-xml-parser";
import { readFileSync } from "fs";
import { CreateChartID, MutateCollection, ReadCollection, WriteCollection } from "../../util";
import { ChartDocument, Difficulties, Playtypes, SongDocument, Versions } from "tachi-common";
import { GITADORA_GITA_CONF } from "tachi-common/config/game-support/gitadora";

const supportedVersions = Object.keys(GITADORA_GITA_CONF.versions);

const program = new Command();
program.requiredOption("-i, --input <music_db.xml>");
program.requiredOption(`-v, --version <${supportedVersions.join("|")}>`);
program.parse(process.argv);

const options = program.opts();
const parser = new XMLParser({ ignoreAttributes: false });
const content = readFileSync(options.input, { encoding: "utf-8" }); // Genuinely surprised its utf-8 encoded
const data = parser.parse(content);

if (!supportedVersions.includes(options.version)) {
	console.error(
		`Invalid version ${options.version}. Expected any of ${supportedVersions.join(", ")}.`
	);
	throw new Error(`Invalid version ${options.version}.`);
}
const version: Versions["gitadora:Gita" | "gitadora:Dora"] = options.version;

interface XMLText<T> {
	"#text": T;
}

// There's a lot of fields here that we are likely going to ignore, but it's here for reference
interface Entry {
	music_id: XMLText<number>;
	classics_diff_list: XMLText<string>;
	xg_diff_list: XMLText<string>;
	pad_diff: XMLText<number>;
	seq_flag: XMLText<number>;
	xg_seq_flag: XMLText<number>;
	contain_stat: XMLText<string>;
	first_ver: XMLText<string>;
	first_classic_ver: XMLText<string>;
	b_long: XMLText<number>; // Boolean
	b_eemall: XMLText<number>; // Boolean
	bpm: XMLText<number>;
	bpm2: XMLText<number>;
	title_ascii: XMLText<string>;
	order_ascii: XMLText<number>;
	order_kana: XMLText<number>;
	category_kana: XMLText<number>;
	artist_title_ascii: XMLText<string>;
	artist_order_ascii: XMLText<number>;
	artist_order_kana: XMLText<number>;
	artist_category_kana: XMLText<number>;
	secret: XMLText<string>;
	xg_secret: XMLText<string>;
	b_session: XMLText<number>; // Boolean
	xg_b_session: XMLText<number>; // Boolean
	speed: XMLText<number>;
	life: XMLText<number>;
	gf_ofst: XMLText<number>;
	dm_ofst: XMLText<number>;
	chart_list: XMLText<string>;
	origin: XMLText<number>;
	music_type: XMLText<number>;
	genre: XMLText<number>;
	xg_active_effect_type: XMLText<number>;
	xg_movie_disp_type: XMLText<number>;
	xg_movie_disp_id: XMLText<number>;
	is_remaster: XMLText<number>; // Not Boolean ?
	title_name: XMLText<string>;
	license_disp: XMLText<number>;
	default_music: XMLText<string>;
	disable_area: XMLText<string>;
	type_category: XMLText<number>;
	data_ver: XMLText<number>;
	seq_id: XMLText<number>;
	is_classic_seq: XMLText<number>; // Not Boolean ?
}

// Used for destructuring the difficulty byte array - see implementation for mapping
const DIFFICULTIES: (Difficulties["gitadora:Gita" | "gitadora:Dora"] | null)[] = [
	null,
	"BASIC",
	"ADVANCED",
	"EXTREME",
	"MASTER",
	null,
	"BASS BASIC",
	"BASS ADVANCED",
	"BASS EXTREME",
	"BASS MASTER",
	null,
	"BASIC",
	"ADVANCED",
	"EXTREME",
	"MASTER",
];
const PLAYTYPE_DIFFICULTY_MAP: (Playtypes["gitadora"] | null)[] = [
	null,
	"Gita",
	"Gita",
	"Gita",
	"Gita",
	null,
	"Gita",
	"Gita",
	"Gita",
	"Gita",
	null,
	"Dora",
	"Dora",
	"Dora",
	"Dora",
];

function buildSong(entry: Entry): SongDocument<"gitadora"> {
	return {
		artist: entry.artist_title_ascii["#text"],
		title: entry.title_name["#text"],
		id: entry.music_id["#text"],
		altTitles: [],
		searchTerms: entry.title_ascii ? [entry.title_ascii["#text"]] : [],
		data: {},
	};
}

const buildChart = (
	entry: Entry,
	difficulty: number,
	difficultyString: Difficulties["gitadora:Gita" | "gitadora:Dora"],
	playType: Playtypes["gitadora"]
): ChartDocument<"gitadora:Gita" | "gitadora:Dora"> => {
	// Comes in a 435, needs to become "4.35"
	const convertedDifficultyAsFloat = difficulty / 100;
	const convertedDifficultyAsString = convertedDifficultyAsFloat.toFixed(2);

	return {
		chartID: CreateChartID(),
		data: {
			inGameID: entry.music_id["#text"],
		},
		difficulty: difficultyString,
		isPrimary: true,
		level: convertedDifficultyAsString,
		levelNum: convertedDifficultyAsFloat,
		playtype: playType,
		songID: entry.music_id["#text"],
		versions: [version],
	};
};

const songs = ReadCollection("songs-gitadora.json");
const existingChartDocs = ReadCollection("charts-gitadora.json");
const existingCharts = new Map<string, ChartDocument<"gitadora:Gita" | "gitadora:Dora">>();
for (const chart of existingChartDocs) {
	existingCharts.set(`${chart.data.inGameID}-${chart.difficulty}-${chart.playtype}`, chart);
}

const newSongs: SongDocument<"gitadora">[] = [];
const newCharts: ChartDocument<"gitadora:Gita" | "gitadora:Dora">[] = [];
for (const entry of data.mdb.mdb_data as Entry[]) {
	// For logging purposes - song may not exist, not safe to access for logging
	const mid = entry.music_id["#text"];
	const title = entry.title_name["#text"];
	const artist = entry.artist_title_ascii["#text"];

	if (!artist) {
		console.warn(`Bailing early... null artist? (id: ${mid})`);
		continue;
	}

	if (!title) {
		console.warn(`Bailing early... null title? (id: ${mid})`);
		continue;
	}

	const song = songs.find((s: SongDocument<"gitadora">) => s.id === mid);
	if (!song) {
		const newSong = buildSong(entry);
		console.log(`New song: ${newSong.artist} - ${newSong.title} (id ${newSong.id})`);
		newSongs.push(newSong);
	}

	// | GUITAR          | BASS            | DRUMS
	// | BSC ADV EXT MAS | BSC ADV EXT MAS | BSC ADV EXT MAS
	// 0 100 200 300 400 0 100 200 300 400 0 100 200 300 400
	const splitDiff = entry.xg_diff_list["#text"].split(" ");
	for (let i = 0; i < 15; i++) {
		const diff = splitDiff[i]!;
		if (diff === "0") {
			continue; // There is no score for this difficulty
		}

		const difficulty = DIFFICULTIES[i];
		const playType = PLAYTYPE_DIFFICULTY_MAP[i];
		if (!difficulty || !playType) {
			continue; // We're at the padding byte
		}

		const exists = existingCharts.get(`${mid}-${difficulty}-${playType}`);
		if (exists) {
			if (!exists.versions.includes(version)) {
				console.log(
					`Adding version ${version} to chart ${exists.playtype} ${exists.difficulty} of song ${song.artist} - ${song.title} (id ${mid})`
				);
				exists.versions.push(version);
			}
		} else {
			const newChart = buildChart(entry, parseInt(diff, 10), difficulty, playType);
			console.log(
				`New chart detected: ${newChart.playtype} ${newChart.difficulty} for song ${artist} - ${title} (id ${mid})`
			);
			newCharts.push(newChart);
		}
	}
}

MutateCollection("songs-gitadora.json", (songs: Array<SongDocument<"gitadora">>) => [
	...songs,
	...newSongs,
]);

// overwrite this collection instead of mutating it
// we already know the existing chart docs and might have mutated them to
// declare the new versions, or update chart constants.
WriteCollection("charts-gitadora.json", [...existingChartDocs, ...newCharts]);
