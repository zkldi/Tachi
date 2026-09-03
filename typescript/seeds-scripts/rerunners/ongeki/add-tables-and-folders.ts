import { Command } from "commander";
import { type FolderDocument, GetGameConfig } from "tachi-common";
import { type SeedFolderRow } from "tachi-common/lib/folder-slug";
import crypto from "crypto";

import { CreateFolderID, CreateTableID, CreateLegacyFolderID, MutateCollection } from "../../util";

const LEVELS = [
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"7+",
	"8",
	"8+",
	"9",
	"9+",
	"10",
	"10+",
	"11",
	"11+",
	"12",
	"12+",
	"13",
	"13+",
	"14",
	"14+",
	"15",
	"15+",
];
const DIFFICULTIES = [
	["BASIC", "basic"],
	["ADVANCED", "advanced"],
	["EXPERT", "expert"],
	["MASTER", "master"],
	["LUNATIC", "lunatic"],
	["Re:MASTER", "lunatic-remaster"],
];
const GENRES = [
	["POPS＆ANIME", "pna"],
	["niconico", "niconico"],
	["東方Project", "toho"],
	["VARIETY", "variety"],
	["チュウマイ", "chumai"],
	["オンゲキ", "ongeki"],
];

const command = new Command().requiredOption("-v, --version <version>").parse(process.argv);
const options = command.opts();
const version = options.version;

const tachiVersions = GetGameConfig("ongeki").versions;
const versionName = tachiVersions[version];

if (!versionName) {
	throw new Error(
		`Invalid version of ${version}. Please update game config before adding tables and folders.`,
	);
}

const newFolders: SeedFolderRow[] = [];
const levelFolderIDs: string[] = [];
const difficultyFolderIDs: string[] = [];

for (const level of LEVELS) {
	newFolders.push({
		game: "ongeki",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: `F${crypto.randomBytes(32).toString("hex")}`,
		searchTerms: [],
		slug: `${level}-${version.toLowerCase()}`,
		title: `Level ${level} (${versionName})`,
		versionFilter: [version],
		where: `chart.data->>'isBonusTrack' = 'false' AND chart.level = '${level}'`,
	});
}

for (const [fullName, safeName] of DIFFICULTIES) {
	newFolders.push({
		game: "ongeki",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: `F${crypto.randomBytes(32).toString("hex")}`,
		searchTerms: [],
		slug: `${version.toLowerCase()}-${safeName}`,
		title: `${fullName} (${versionName})`,
		versionFilter: [version],
		where: `chart.data->>'isBonusTrack' = 'false' AND chart.difficulty = '${fullName}'`,
	});
}

for (const [fullName, safeName] of GENRES) {
	newFolders.push({
		game: "ongeki",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: `F${crypto.randomBytes(32).toString("hex")}`,
		searchTerms: [],
		slug: `g-${safeName}-${version.toLowerCase()}`,
		title: `${fullName} (${versionName})`,
		versionFilter: [version],
		where: `(song.data->>'genre')::text = '${fullName}' AND (chart.difficulty = 'MASTER' OR chart.difficulty = 'Re:MASTER')`,
	});
}

MutateCollection("tables.json", (ts) => {
	ts.push(
		{
			default: false,
			description: `Levels for O.N.G.E.K.I. in ${versionName}.`,
			folders: levelFolderIDs,
			game: "ongeki",
			inactive: false,
			playtype: "Single",
			tableID: `ongeki-Single-${version}-levels`,
			title: `O.N.G.E.K.I. (${versionName})`,
		},
		{
			default: false,
			description: `Difficulties for O.N.G.E.K.I. in ${versionName}.`,
			folders: difficultyFolderIDs,
			game: "ongeki",
			inactive: false,
			playtype: "Single",
			tableID: `ongeki-Single-${version}-difficulties`,
			title: `O.N.G.E.K.I. (${versionName}) (Difficulties)`,
		},
		{
			default: false,
			description: `Genres for O.N.G.E.K.I. in ${versionName}.`,
			folders: GENRES.map(([_, g]) => `g-${g}-${version.toLowerCase()}`),
			game: "ongeki",
			id: CreateTableID(),
			inactive: false,
			legacyTableID: `ongeki-Single-${version}-genres`,
			title: `O.N.G.E.K.I. (${versionName}) (Genres)`,
		},
	);

	return ts;
});

MutateCollection("folders.json", (fs) => [...fs, ...newFolders]);
