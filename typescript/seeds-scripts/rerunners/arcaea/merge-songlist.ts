import { Command } from "commander";
import fjsh from "fast-json-stable-hash";
import fs from "fs";
import {
	type ChartDocument,
	type Difficulties,
	type integer,
	type SongDocument,
} from "tachi-common";
import crypto from "crypto";

import {
	CreateChartID,
	CreateSongID,
	GetFreshSongIDGenerator,
	ReadCollection,
	WriteCollection,
} from "../../util";

type LocalizedText = { en: string } & Record<string, string>;
type LocalizedSearchTerms = Record<string, Array<string>>;

interface SonglistChart {
	ratingClass: integer;
	title_localized?: LocalizedText;
	artist?: string;
	audioOverride?: boolean;
	rating: number;
	ratingPlus?: boolean;
	version?: string;
	hidden_until_unlocked?: boolean;
	hidden_until?: "always" | "difficulty" | "none" | "song";
}

interface SonglistEntry {
	idx: integer;
	id: string;
	title_localized: LocalizedText;
	artist: string;
	set: string;
	search_title?: LocalizedSearchTerms;
	search_artist?: LocalizedSearchTerms;
	version: string;
	difficulties: Array<SonglistChart>;
	deleted?: boolean;
}

interface PacklistEntry {
	id: string;
	pack_parent?: string;
	name_localized: LocalizedText;
	description_localized: LocalizedText;
}

class MultiMapUniqueValues<K, V> {
	private hashMap: Map<K, Array<string>>;
	private map: Map<K, Array<V>>;

	constructor(iterable?: Iterable<readonly [K, V]> | null | undefined) {
		this.map = new Map();
		this.hashMap = new Map();
		if (iterable) {
			for (const pair of iterable) {
				this.set(pair[0], pair[1]);
			}
		}
	}

	get(key: K) {
		return this.map.get(key);
	}

	set(key: K, value: V) {
		const valueHash = fjsh.hash(value, "SHA256");
		const existingHashes = this.hashMap.get(key);
		if (!existingHashes) {
			this.map.set(key, [value]);
			this.hashMap.set(key, [valueHash]);
			return this;
		}

		if (existingHashes.includes(valueHash)) {
			return this;
		}

		const existingEntries = this.get(key) ?? [];
		existingEntries.push(value);
		existingHashes.push(valueHash);
		this.map.set(key, existingEntries);
		this.hashMap.set(key, existingHashes);

		return this;
	}
}

function convertDifficulty(input: integer): Difficulties["arcaea"] {
	switch (input) {
		case 0:
			return "Past";
		case 1:
			return "Present";
		case 2:
			return "Future";
		case 3:
			return "Beyond";
		case 4:
			return "Eternal";
	}

	throw new Error(
		`Unknown difficulty ${input}, can't convert this into one of Tachi's Arcaea difficulties. Consider updating the merge-songlist.ts script.`,
	);
}

function convertPackName(packsByID: Record<string, PacklistEntry>, packID: string) {
	if (packID === "single") {
		return "Memory Archive";
	}

	const pack = packsByID[packID];

	if (!pack) {
		throw new Error(
			`Unknown pack ${packID}, can't convert this into a pack name. Check your "packlist".`,
		);
	}

	if (pack.pack_parent) {
		const parentPack = packsByID[pack.pack_parent];
		if (!parentPack) {
			throw new Error(
				`${packID} declares parent ${pack.pack_parent}, but no packs with such ID exists. Check your "packlist".`,
			);
		}
		return `${pack.name_localized.en} (${parentPack.name_localized.en})`;
	}

	return pack.name_localized.en;
}

const program = new Command();
program.requiredOption("-i, --input <songlist>");
program.requiredOption("-p, --packlist <packlist>");

program.parse(process.argv);
const options = program.opts();

const content = fs.readFileSync(options.input, { encoding: "utf-8" });
const data: { songs: Array<SonglistEntry> } = JSON.parse(content);

const packlistContent = fs.readFileSync(options.packlist, { encoding: "utf-8" });
const packlistData: { packs: Array<PacklistEntry> } = JSON.parse(packlistContent);
const packsByID = Object.fromEntries(packlistData.packs.map((p) => [p.id, p]));

const existingSongDocsById: Map<number, SongDocument<"arcaea">> = new Map(
	ReadCollection("songs-arcaea.json").map((e: SongDocument<"arcaea">) => [e.id, e]),
);
const existingChartDocs: Array<ChartDocument<"arcaea">> = ReadCollection("charts-arcaea.json");
const inGameIDToSongsMap: MultiMapUniqueValues<
	string,
	SongDocument<"arcaea">
> = new MultiMapUniqueValues();
const existingCharts: Map<string, ChartDocument<"arcaea">> = new Map();

for (const chart of existingChartDocs) {
	const song = existingSongDocsById.get(chart.songID);
	if (!song) {
		console.warn(`Chart ${chart.songID} does not belong to any song?`);
		continue;
	}
	inGameIDToSongsMap.set(chart.data.inGameStrID, song);
	existingCharts.set(`${chart.data.inGameStrID}-${chart.difficulty}`, chart);
}

const getNewSongID = GetFreshSongIDGenerator("arcaea");

const newSongs: Array<SongDocument<"arcaea">> = [];
const newCharts: Array<ChartDocument<"arcaea">> = [];

for (const entry of data.songs) {
	if (entry.deleted) {
		continue;
	}
	const inGameID = entry.id;
	let possibleSongs = inGameIDToSongsMap.get(inGameID);

	const searchTerms = Object.values(entry.search_title ?? {})
		.flatMap((t) => t)
		// Necessary because some songs have blank search terms
		// e.g. qualia -ideaesthesia-
		.filter((t) => t);

	if (!possibleSongs) {
		const title = entry.title_localized.en;

		// Deduplicated because multiple languages might have the same alt titles
		const altTitles = [
			...new Set(Object.values(entry.title_localized).filter((t) => t !== title)),
		];

		const songDoc: SongDocument<"arcaea"> = {
			title,
			artist: entry.artist,
			altTitles,
			searchTerms,
			id: CreateSongID(),
			legacySongID: getNewSongID(),
			data: {
				songPack: convertPackName(packsByID, entry.set),
			},
		};

		possibleSongs = [songDoc];
		newSongs.push(songDoc);
		inGameIDToSongsMap.set(inGameID, songDoc);
	}

	for (const chart of entry.difficulties) {
		let song: SongDocument<"arcaea">;

		if (chart.hidden_until_unlocked && chart.hidden_until === "always") {
			// Deactivated difficulty
			continue;
		}

		if (chart.rating === 0) {
			continue;
		}

		const difficulty = convertDifficulty(chart.ratingClass);
		const exists = existingCharts.get(`${inGameID}-${difficulty}`);

		if (exists) {
			// update chart levels
			exists.level = `${chart.rating}${chart.ratingPlus ? "+" : ""}`;
			continue;
		}

		if (
			chart.audioOverride &&
			chart.title_localized &&
			!possibleSongs.some((t) => t.title === chart.title_localized?.en)
		) {
			// There are some songs (all BYD) that share the same set
			// with other songs.

			const title = chart.title_localized.en;
			const altTitles = [
				...new Set(Object.values(chart.title_localized).filter((t) => t !== title)),
			];

			const songDoc: SongDocument<"arcaea"> = {
				title,
				artist: chart.artist ?? entry.artist,
				altTitles,
				searchTerms,
				id: CreateSongID(),
				legacySongID: getNewSongID(),
				data: {
					songPack: convertPackName(packsByID, entry.set),
				},
			};

			song = songDoc;
			newSongs.push(songDoc);
			inGameIDToSongsMap.set(inGameID, songDoc);
		} else {
			const title = chart.title_localized?.en ?? entry.title_localized.en;
			const possibleSong = possibleSongs.find((e) => e.title === title);

			if (!possibleSong) {
				console.error(`No song with inGameID ${inGameID} matches title ${title}?`);
				continue;
			}

			song = possibleSong;
		}

		const chartDoc: ChartDocument<"arcaea"> = {
			id: CreateChartID(),
			songID: song.id,
			legacyChartID: crypto.randomBytes(20).toString("hex"),
			difficulty,
			isPrimary: true,
			level: `${chart.rating}${chart.ratingPlus ? "+" : ""}`,
			levelNum: chart.rating + (chart.ratingPlus ? 0.7 : 0),
			versions: ["mobile"],
			data: {
				inGameStrID: inGameID,
				displayVersion: chart.version ?? entry.version,
			},
		};
		newCharts.push(chartDoc);
	}
}

WriteCollection("songs-arcaea.json", [...existingSongDocsById.values(), ...newSongs]);
WriteCollection("charts-arcaea.json", [...existingChartDocs, ...newCharts]);
