import { CreateFolderID, MutateCollection } from "../../util.js";

// Change these for whatever table you are adding.
const GAME = "maimaidx";
const PLAYTYPES = ["Single"];
const PREFIX = "Level";
const VERSION = "CiRCLE";
const VERSIONID = "circle";
const TITLE = `maimai DX (${VERSION})`;
const SHORTTITLE = `${VERSIONID}-levels`; // this is used in the tableID
const DESCRIPTION = `Levels for maimai DX in ${VERSION}.`;
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
];

const ptFolders = {};

MutateCollection("folders.json", (foldersCol) => {
	for (const level of LEVELS) {
		const folder = {
			data: {
				level,
				versions: VERSIONID,
			},
			game: GAME,
			inactive: false,
			searchTerms: [],
			title: `${PREFIX} ${level} (${VERSION})`,
			type: "charts",
		};

		for (const playtype of PLAYTYPES) {
			const folderID = CreateFolderID(folder.data, folder.game, playtype);

			const realFolder = Object.assign({ folderID, playtype }, folder);

			if (ptFolders[playtype]) {
				ptFolders[playtype].push(realFolder);
			} else {
				ptFolders[playtype] = [realFolder];
			}

			foldersCol.push(realFolder);
		}
	}

	return foldersCol;
});

MutateCollection("tables.json", (tables) => {
	for (const playtype of PLAYTYPES) {
		tables.push({
			default: false,
			description: DESCRIPTION,
			folders: ptFolders[playtype].map((e) => e.folderID),
			game: GAME,
			inactive: false,
			playtype,
			tableID: `${GAME}-${playtype}-${SHORTTITLE}`,
			title: TITLE,
		});
	}

	return tables;
});
