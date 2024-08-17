import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
	ChartDocument,
	Difficulties,
	GPTStrings,
	integer,
	Playtypes,
	SongDocument,
} from "tachi-common";
import { CreateChartID, GetFreshScoreIDGenerator, MutateCollection } from "../../util";

interface AixChart {
	bpm_max: integer;
	bpm_min: integer;
	note_count: integer;
	rating: integer;
}

type ChartStrings = "spb" | `${"sp" | "dp"}${"n" | "h" | "a" | "l"}`;

interface AixData {
	artist: string;
	charts: Partial<Record<ChartStrings, AixChart>>;
	entry_id: integer;
	genre: string;
	title: string;
	title_ascii: string;
}

function ConvertAixStuff(d: AixData, songID: integer) {
	const searchTerms: Array<string> = [];

	if (d.title !== d.title_ascii) {
		searchTerms.push(d.title_ascii);
	}

	const song: SongDocument<"iidx"> = {
		title: d.title,
		artist: d.artist,
		altTitles: [],
		searchTerms,
		data: {
			displayVersion: "inf",
			genre: d.genre,
		},
		id: songID,
	};

	const charts: Array<ChartDocument<GPTStrings["iidx"]>> = [];
	for (const [diff, c] of Object.entries(d.charts)) {
		// wonderful ts oddity
		charts.push(ParseAixChart(d, c, diff as ChartStrings, songID));
	}

	return { song, charts };
}

const DIFF_MAP = {
	b: "BEGINNER",
	n: "NORMAL",
	h: "HYPER",
	a: "ANOTHER",
	l: "LEGGENDARIA",
} as const;

function SplitAixDiff(diff: ChartStrings): {
	playtype: Playtypes["iidx"];
	difficulty: Difficulties["iidx:SP" | "iidx:DP"];
} {
	const difficulty = DIFF_MAP[diff[2]];

	if (!difficulty) {
		throw new Error(`Couldn't convert ${diff} to difficulty.`);
	}

	return {
		playtype: diff.startsWith("sp") ? "SP" : "DP",
		difficulty,
	};
}

function ParseAixChart(d: AixData, c: AixChart, diff: ChartStrings, songID: integer) {
	const { difficulty, playtype } = SplitAixDiff(diff);

	let chart: ChartDocument<GPTStrings["iidx"]>;

	if (playtype === "SP") {
		const temp: ChartDocument<"iidx:SP"> = {
			chartID: CreateChartID(),
			data: {
				notecount: c.note_count,
				inGameID: d.entry_id,
				"2dxtraSet": null,
				bpiCoefficient: null,
				hashSHA256: null,
				kaidenAverage: null,
				worldRecord: null,
				exhcTier: null,
				hcTier: null,
				ncTier: null,
			},
			difficulty,
			playtype,
			isPrimary: true,
			level: c.rating.toString(),
			levelNum: c.rating,
			songID,
			versions: ["INFINITAS"],
		};

		chart = temp;
	} else {
		const temp: ChartDocument<"iidx:DP"> = {
			chartID: CreateChartID(),
			data: {
				notecount: c.note_count,
				inGameID: d.entry_id,
				"2dxtraSet": null,
				bpiCoefficient: null,
				hashSHA256: null,
				kaidenAverage: null,
				worldRecord: null,
				dpTier: null,
			},
			difficulty,
			playtype,
			isPrimary: true,
			level: c.rating.toString(),
			levelNum: c.rating,
			songID,
			versions: ["INFINITAS"],
		};

		chart = temp;
	}

	return chart;
}

if (require.main === module) {
	const files = readdirSync(__dirname);

	const getSongID = GetFreshScoreIDGenerator("iidx");

	const newSongs: Array<SongDocument<"iidx">> = [];
	const newCharts: Array<ChartDocument<GPTStrings["iidx"]>> = [];
	for (const file of files) {
		if (file.endsWith(".json")) {
			const songID = getSongID();

			const aixData = JSON.parse(readFileSync(join(__dirname, file), "utf8"));

			const { song, charts } = ConvertAixStuff(aixData, songID);

			newSongs.push(song);
			newCharts.push(...charts);
		}
	}

	MutateCollection("charts-iidx.json", (charts) => [...charts, ...newCharts]);
	MutateCollection("songs-iidx.json", (songs) => [...songs, ...newSongs]);
}
