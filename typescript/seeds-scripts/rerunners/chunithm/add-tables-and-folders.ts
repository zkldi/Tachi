import type { SEEDS_FolderDocument, SEEDS_TableDocument } from "tachi-common/types";

import { Command } from "commander";
import fjsh from "fast-json-stable-hash";
import { computeFolderSlug, GetGameConfig } from "../../../common/src";

import { CreateFolderID, CreateTableID, MutateCollection, ReadCollection } from "../../util";

function CreateLegacyFolderID(query: any, game: string, playtype: string) {
	return `F${fjsh.hash(Object.assign({ game, playtype }, query), "SHA256")}`;
}

const LEVELS = [
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
	"16",
];
const DIFFICULTIES = [
	"BASIC",
	"ADVANCED",
	"EXPERT",
	"MASTER",
	"ULTIMA",
	"MASTER+ULTIMA",
	"WORLD'S END",
];

const existingFolderSlugs = new Set(
	(ReadCollection("folders.json") as Array<SEEDS_FolderDocument>)
		.filter((f) => f.game === "chunithm")
		.map((f) => f.slug),
);

const command = new Command().requiredOption("-v, --version <version>").parse(process.argv);
const options = command.opts();
const version = options.version;

const tachiVersions = GetGameConfig("chunithm").versions;
const versionName = tachiVersions[version];

if (!versionName) {
	throw new Error(
		`Invalid version of ${version}. Please update game config before adding tables and folders.`,
	);
}

const newFolders: Array<SEEDS_FolderDocument> = [];
const levelFolderSlugs: Array<string> = [];
const difficultyFolderSlugs: Array<string> = [];

for (const level of LEVELS) {
	const folder: SEEDS_FolderDocument = {
		game: "chunithm",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: CreateLegacyFolderID({ level, versions: version }, "chunithm", "Single"),
		searchTerms: [],
		slug: "",
		title: `Level ${level} (${versionName})`,
		where: `chart.level = '${level}'`,
		versionFilter: [version],
	};
	folder.slug = computeFolderSlug(folder);

	levelFolderSlugs.push(folder.slug);

	if (existingFolderSlugs.has(folder.slug)) {
		continue;
	}

	newFolders.push(folder);
	existingFolderSlugs.add(folder.slug);
}

for (const difficulty of DIFFICULTIES) {
	const folder: SEEDS_FolderDocument = {
		game: "chunithm",
		id: CreateFolderID(),
		inactive: false,
		legacyFolderID: "",
		searchTerms: [],
		slug: "",
		title: `${difficulty} (${versionName})`,
		where: "",
		versionFilter: [version],
	};

	if (difficulty === "MASTER+ULTIMA") {
		folder.where = "chart.difficulty IN ('MASTER', 'ULTIMA')";
		folder.legacyFolderID = CreateLegacyFolderID(
			{ difficulty: { "~in": ["MASTER", "ULTIMA"] }, versions: version },
			"chunithm",
			"Single",
		);
	} else if (difficulty === "WORLD'S END") {
		// inGameID is a number and inGameID >= 8000
		// OR inGameID is an array and all numbers must be >= 8000
		folder.where =
			"((jsonb_typeof(chart.data->'inGameID') = 'number' AND (chart.data->>'inGameID')::int >= 8000) OR (jsonb_typeof(chart.data->'inGameID') = 'array' AND jsonb_path_match(chart.data->'inGameID', '!exists($.* ? (@ < 8000))')))";
		folder.legacyFolderID = CreateLegacyFolderID(
			{ "data¬inGameID": { "~ge": 8000 }, versions: version },
			"chunithm",
			"Single",
		);
	} else {
		folder.where = `chart.difficulty = '${difficulty}'`;
		folder.legacyFolderID = CreateLegacyFolderID(
			{ difficulty, versions: version },
			"chunithm",
			"Single",
		);
	}

	folder.slug = computeFolderSlug(folder);

	difficultyFolderSlugs.push(folder.slug);

	if (existingFolderSlugs.has(folder.slug)) {
		continue;
	}

	newFolders.push(folder);
	existingFolderSlugs.add(folder.slug);
}

MutateCollection("tables.json", (ts: Array<SEEDS_TableDocument>) => {
	const levelTableTitle = `CHUNITHM (${versionName})`;
	const levelTable = ts.find((t) => t.title === levelTableTitle);

	const difficultyTableTitle = `CHUNITHM (${versionName}) (Difficulties)`;
	const difficultyTable = ts.find((t) => t.title === difficultyTableTitle);

	if (levelTable !== undefined) {
		levelTable.folders = levelFolderSlugs;
	} else {
		ts.push({
			default: false,
			description: `Levels for CHUNITHM in ${versionName}.`,
			folders: levelFolderSlugs,
			game: "chunithm",
			id: CreateTableID(),
			inactive: false,
			legacyTableID: `chunithm-Single-${version}-levels`,
			title: levelTableTitle,
		});
	}

	if (difficultyTable !== undefined) {
		difficultyTable.folders = difficultyFolderSlugs;
	} else {
		ts.push({
			default: false,
			description: `Difficulties for CHUNITHM in ${versionName}.`,
			folders: difficultyFolderSlugs,
			game: "chunithm",
			id: CreateTableID(),
			inactive: false,
			legacyTableID: `chunithm-Single-${version}-difficulties`,
			title: difficultyTableTitle,
		});
	}

	return ts;
});

MutateCollection("folders.json", (fs: Array<SEEDS_FolderDocument>) => [...fs, ...newFolders]);
