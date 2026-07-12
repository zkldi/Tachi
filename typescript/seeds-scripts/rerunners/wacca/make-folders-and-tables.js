import { Command } from "commander";
import { GetGamePTConfig } from "../../../common/src/index.ts";

import { CreateFolderID, MutateCollection } from "../../util.js";

const LEVELS = [
	"1",
	"2",
	"3",
	"4",
	"5",
	"5+",
	"6",
	"6+",
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
];
// don't add 14-15 here, they'll be handled later.

const command = new Command().requiredOption("-v, --version <version>").parse(process.argv);
const options = command.opts();
const version = options.version;

const tachiVersions = GetGamePTConfig("wacca", "Single").versions;
const versionName = tachiVersions[version];

if (!versionName) {
	throw new Error(
		`Invalid version of ${version}. Please update game config before adding tables and folders.`,
	);
}

const newFolders = [];
const levelFolderIDs = [];
for (const level of LEVELS) {
	const data = { level, versions: version };
	const folderID = CreateFolderID(data, "wacca", "Single");

	levelFolderIDs.push(folderID);

	newFolders.push({
		data,
		folderID,
		game: "wacca",
		inactive: false,
		playtype: "Single",
		searchTerms: [],
		title: `Level ${level} (${versionName})`,
		type: "charts",
	});
}
// add 14-15 folder

const data = { level: { "~in": ["14", "15"] }, versions: version };
const folderID = CreateFolderID(data, "wacca", "Single");

levelFolderIDs.push(folderID);

newFolders.push({
	data,
	folderID,
	game: "wacca",
	inactive: false,
	playtype: "Single",
	searchTerms: [],
	title: `Level 14-15 (${versionName})`,
	type: "charts",
});

MutateCollection("tables.json", (ts) => {
	ts.push({
		default: false,
		description: `Levels for WACCA in ${versionName}.`,
		folders: levelFolderIDs,
		game: "wacca",
		inactive: false,
		playtype: "Single",
		tableID: `wacca-Single-${version}-levels`,
		title: `WACCA (${versionName})`,
	});

	return ts;
});

MutateCollection("folders.json", (fs) => [...fs, ...newFolders]);
