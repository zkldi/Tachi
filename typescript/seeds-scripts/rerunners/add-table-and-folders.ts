import { CreateTableID, SEEDS_FolderDocument, SEEDS_TableDocument } from "tachi-common";
import { CreateFolderID, CreateRandomLegacyFolderID, MutateCollection } from "../util.js";

// The original intention was for you to
// change these for whatever table you are adding.
// But it would be better if you only used this as a reference
// and made a dedicated rerunner.
const GAME = "ddr-sp";
const PREFIX = "Level ";
const TITLE = "DDR A3";
const SHORTTITLE = "a3"; // this is used in the tableID
const VERSION = "a3";
const DESCRIPTION = "All songs in DDR A3";
const LEVELS = [
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"11",
	"12",
	"13",
	"14",
	"15",
	"16",
	"17",
	"18",
	"19",
];

const slugs: string[] = [];

MutateCollection("folders.json", (foldersCol: SEEDS_FolderDocument[]) => {
	for (const level of LEVELS) {
		const slug = `${level}-${SHORTTITLE}`;
		const folder: SEEDS_FolderDocument = {
			game: GAME,
			id: CreateFolderID(),
			inactive: false,
			legacyFolderID: CreateRandomLegacyFolderID(),
			searchTerms: [],
			slug,
			title: `${PREFIX}${level}`,
			versionFilter: [VERSION],
			where: `chart.level = '${level}'`,
		};

		slugs.push(slug);
		foldersCol.push(folder);
	}

	return foldersCol;
});

MutateCollection("tables.json", (tables: SEEDS_TableDocument[]) => {
	tables.push({
		default: false,
		description: DESCRIPTION,
		folders: slugs,
		game: GAME,
		inactive: false,
		id: CreateTableID(),
		legacyTableID: `${GAME}-${SHORTTITLE}`,
		title: TITLE,
	});

	return tables;
});
