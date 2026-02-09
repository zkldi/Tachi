import { Command } from "commander";
import { ChartDocument, FolderDocument, GetGamePTConfig, TableDocument } from "tachi-common";
import { CreateFolderID, MutateCollection } from "../../util";
import { FilterQuery } from "mongodb";

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
const GENRES = [
	"POPS＆ANIME",
	"niconico",
	"東方Project",
	"VARIETY",
	"チュウマイ",
	"オンゲキ",
	"LUNATIC",
];

const COMMAND = new Command().requiredOption("-v, --version <version>").parse(process.argv);
const OPTIONS = COMMAND.opts();
const VERSION = OPTIONS.version;
const VERSION_NAME = GetGamePTConfig("ongeki", "Single").versions[VERSION];

if (!VERSION_NAME) {
	throw new Error(
		`Invalid version ${VERSION}. Please update game config before adding tables and folders.`
	);
}

const NEW_FOLDERS: FolderDocument[] = [];
const LEVEL_FOLDER_IDS: string[] = [];
const DIFFICULTY_FOLDER_IDS: string[] = [];
const GENRE_FOLDER_IDS: string[] = [];

for (const level of LEVELS) {
	const data = {
		level,
		versions: VERSION,
		"data¬isBonusTrack": false,
	};

	const folderID = CreateFolderID(data, "ongeki", "Single");

	LEVEL_FOLDER_IDS.push(folderID);

	NEW_FOLDERS.push({
		data,
		folderID,
		game: "ongeki",
		inactive: false,
		playtype: "Single",
		searchTerms: [],
		title: `Level ${level} (${VERSION_NAME})`,
		type: "charts",
	});
}

for (const difficulty of DIFFICULTIES) {
	const data = { difficulty, versions: VERSION, "data¬isBonusTrack": false };

	if (difficulty === "LUNATIC") {
		data["data¬isReMaster"] = false;
	} else if (difficulty === "Re:MASTER") {
		data["data¬isReMaster"] = true;
		data.difficulty = "LUNATIC";
	}

	const folderID = CreateFolderID(data, "ongeki", "Single");

	DIFFICULTY_FOLDER_IDS.push(folderID);

	NEW_FOLDERS.push({
		data,
		folderID,
		game: "ongeki",
		inactive: false,
		playtype: "Single",
		searchTerms: [],
		title: `${difficulty} (${VERSION_NAME})`,
		type: "charts",
	});
}

for (const genre of GENRES) {
	if (genre === "ボーナストラック") {
		continue;
	}
	const genreName = genre === "LUNATIC" ? "LUNATIC-only" : genre;
	const data = {
		versions: VERSION,
		difficulty: { "~in": ["MASTER", "LUNATIC"] },
		"data¬isBonusTrack": false,
		"data¬genre": genre,
	} as unknown as FilterQuery<ChartDocument>;
	const folderID = CreateFolderID(data, "ongeki", "Single");

	GENRE_FOLDER_IDS.push(folderID);

	NEW_FOLDERS.push({
		data,
		folderID,
		game: "ongeki",
		inactive: false,
		playtype: "Single",
		searchTerms: [],
		title: `${genreName} (${VERSION_NAME})`,
		type: "charts",
	});
}

MutateCollection("tables.json", (ts: TableDocument[]) => {
	const tableIDLevels = `ongeki-Single-${VERSION}-levels`;
	const tableIDDiffs = `ongeki-Single-${VERSION}-difficulties`;
	const tableIDGenres = `ongeki-Single-${VERSION}-genres`;

	if (ts.find((t) => t.tableID === tableIDLevels) === undefined) {
		ts.push({
			default: false,
			description: `Levels for O.N.G.E.K.I. in ${VERSION_NAME}.`,
			folders: LEVEL_FOLDER_IDS,
			game: "ongeki",
			inactive: false,
			playtype: "Single",
			tableID: tableIDLevels,
			title: `O.N.G.E.K.I. (${VERSION_NAME})`,
		});
		console.log(`Added ${tableIDLevels}`);
	} else {
		console.log(`Skipped ${tableIDLevels}`);
	}

	if (ts.find((t) => t.tableID === tableIDDiffs) === undefined) {
		ts.push({
			default: false,
			description: `Difficulties for O.N.G.E.K.I. in ${VERSION_NAME}.`,
			folders: DIFFICULTY_FOLDER_IDS,
			game: "ongeki",
			inactive: false,
			playtype: "Single",
			tableID: tableIDDiffs,
			title: `O.N.G.E.K.I. (${VERSION_NAME}) (Difficulties)`,
		});
		console.log(`Added ${tableIDDiffs}`);
	} else {
		console.log(`Skipped ${tableIDDiffs}`);
	}

	if (ts.find((t) => t.tableID === tableIDGenres) === undefined) {
		ts.push({
			default: false,
			description: `Genres for O.N.G.E.K.I. in ${VERSION_NAME}.`,
			folders: GENRE_FOLDER_IDS,
			game: "ongeki",
			inactive: false,
			playtype: "Single",
			tableID: tableIDGenres,
			title: `O.N.G.E.K.I. (${VERSION_NAME}) (Genres)`,
		});
		console.log(`Added ${tableIDGenres}`);
	} else {
		console.log(`Skipped ${tableIDGenres}`);
	}

	return ts;
});

MutateCollection("folders.json", (folders: FolderDocument[]) => {
	for (const newFolder of NEW_FOLDERS) {
		if (folders.find((f) => f.folderID === newFolder.folderID) === undefined) {
			folders.push(newFolder);
			console.log(`Added ${newFolder.title}`);
		} else {
			console.log(`Skipped ${newFolder.title}`);
		}
	}
	return folders;
});
