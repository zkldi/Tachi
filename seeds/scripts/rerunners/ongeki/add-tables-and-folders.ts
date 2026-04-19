import { Command } from "commander";
import { FolderDocument, GetGamePTConfig } from "tachi-common";
import { CreateFolderID, MutateCollection } from "../../util";

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
const DIFFICULTIES = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "LUNATIC", "Re:MASTER"];

const command = new Command().requiredOption("-v, --version <version>").parse(process.argv);
const options = command.opts();
const version = options.version;

const tachiVersions = GetGamePTConfig("ongeki", "Single").versions;
const versionName = tachiVersions[version];

if (!versionName) {
	throw new Error(
		`Invalid version of ${version}. Please update game config before adding tables and folders.`
	);
}

const newFolders: FolderDocument[] = [];
const levelFolderIDs: string[] = [];
const difficultyFolderIDs: string[] = [];

for (const level of LEVELS) {
	const data = {
		level,
		versions: version,
		"data¬isBonusTrack": false,
	};

	const folderID = CreateFolderID(data, "ongeki", "Single");

	levelFolderIDs.push(folderID);

	newFolders.push({
		data,
		folderID,
		game: "ongeki",
		inactive: false,
		playtype: "Single",
		searchTerms: [],
		title: `Level ${level} (${versionName})`,
		type: "charts",
	});
}

for (const difficulty of DIFFICULTIES) {
	const data = { difficulty, versions: version, "data¬isBonusTrack": false };

	if (difficulty === "LUNATIC") {
		data["data¬isReMaster"] = false;
	} else if (difficulty === "Re:MASTER") {
		data["data¬isReMaster"] = true;
		data.difficulty = "LUNATIC";
	}

	const folderID = CreateFolderID(data, "ongeki", "Single");

	difficultyFolderIDs.push(folderID);

	newFolders.push({
		data,
		folderID,
		game: "ongeki",
		inactive: false,
		playtype: "Single",
		searchTerms: [],
		title: `${difficulty} (${versionName})`,
		type: "charts",
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
		}
	);

	return ts;
});

MutateCollection("folders.json", (fs) => [...fs, ...newFolders]);
