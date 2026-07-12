import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
	type ChartDocument,
	type Difficulties,
	type GamesForGroup,
	type integer,
	type LEGACY_Playtypes,
	type SongDocument,
} from "tachi-common";

import { CreateChartID, GetFreshSongIDGenerator, MutateCollection } from "../../../util";

interface AixChart {
	bpm_max: integer;
	bpm_min: integer;
	note_count: integer;
	rating: integer;
}

type ChartStrings = "spb" | `${"dp" | "sp"}${"a" | "h" | "l" | "n"}`;

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

	const charts: Array<ChartDocument<GamesForGroup["iidx"]>> = [];
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
	difficulty: Difficulties[GamesForGroup["iidx"]];
	playtype: LEGACY_Playtypes["iidx"];
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

	let chart: ChartDocument<GamesForGroup["iidx"]>;

	if (playtype === "SP") {
		const temp: ChartDocument<"iidx-sp"> = {
			game: "iidx-sp",
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
			versions: ["inf"],
		};

		chart = temp;
	} else {
		const temp: ChartDocument<"iidx-dp"> = {
			game: "iidx-dp",
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
			versions: ["inf"],
		};

		chart = temp;
	}

	return chart;
}

if (require.main === module) {
	const files = readdirSync(__dirname);

	const getSongID = GetFreshSongIDGenerator("iidx");

	const newSongs: Array<SongDocument<"iidx">> = [];
	const newCharts: Array<ChartDocument<GamesForGroup["iidx"]>> = [];
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
