import { Command } from "commander";
import { GetGameConfig } from "tachi-common";
import { SEEDS_FolderDocument, SEEDS_TableDocument } from "tachi-common/types/seeds-documents-zod";
import crypto from "crypto";

import { CreateFolderID, CreateTableID, MutateCollection } from "../../util";

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

const newFolders: SEEDS_FolderDocument[] = [];
const levelFolderSlugs: string[] = [];
const difficultyFolderSlugs: string[] = [];
const genreFolderSlugs: string[] = [];

for (const level of LEVELS) {
	const slug = `${level}-${version.toLowerCase()}`;
	newFolders.push({
		game: "ongeki",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: `F${crypto.randomBytes(32).toString("hex")}`,
		searchTerms: [],
		slug,
		title: `Level ${level} (${versionName})`,
		versionFilter: [version],
		where: `chart.data->>'isBonusTrack' = 'false' AND chart.level = '${level}'`,
	});
	levelFolderSlugs.push(slug);
}

for (const [fullName, safeName] of DIFFICULTIES) {
	const slug = `${version.toLowerCase()}-${safeName}`;
	newFolders.push({
		game: "ongeki",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: `F${crypto.randomBytes(32).toString("hex")}`,
		searchTerms: [],
		slug,
		title: `${fullName} (${versionName})`,
		versionFilter: [version],
		where: `chart.data->>'isBonusTrack' = 'false' AND chart.difficulty = '${fullName}'`,
	});
	difficultyFolderSlugs.push(slug);
}

for (const [fullName, safeName] of GENRES) {
	const slug = `g-${safeName}-${version.toLowerCase()}`;
	newFolders.push({
		game: "ongeki",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: `F${crypto.randomBytes(32).toString("hex")}`,
		searchTerms: [],
		slug,
		title: `${fullName} (${versionName})`,
		versionFilter: [version],
		where: `(song.data->>'genre')::text = '${fullName}' AND (chart.difficulty = 'MASTER' OR chart.difficulty = 'Re:MASTER')`,
	});
	genreFolderSlugs.push(slug);
}

MutateCollection("tables.json", (ts) => {
	(ts as SEEDS_TableDocument[]).push(
		{
			default: false,
			description: `Levels for O.N.G.E.K.I. in ${versionName}.`,
			folders: levelFolderSlugs,
			game: "ongeki",
			inactive: false,
			id: CreateTableID(),
			legacyTableID: `ongeki-Single-${version}-levels`,
			title: `O.N.G.E.K.I. (${versionName})`,
		},
		{
			default: false,
			description: `Difficulties for O.N.G.E.K.I. in ${versionName}.`,
			folders: difficultyFolderSlugs,
			game: "ongeki",
			inactive: false,
			id: CreateTableID(),
			legacyTableID: `ongeki-Single-${version}-difficulties`,
			title: `O.N.G.E.K.I. (${versionName}) (Difficulties)`,
		},
		{
			default: false,
			description: `Genres for O.N.G.E.K.I. in ${versionName}.`,
			folders: genreFolderSlugs,
			game: "ongeki",
			inactive: false,
			id: CreateTableID(),
			legacyTableID: `ongeki-Single-${version}-genres`,
			title: `O.N.G.E.K.I. (${versionName}) (Genres)`,
		},
	);

	return ts;
});

MutateCollection("folders.json", (fs) => [...(fs as SEEDS_FolderDocument[]), ...newFolders]);
