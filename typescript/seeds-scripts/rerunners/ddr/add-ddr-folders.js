import { CreateFolderID, MutateCollection } from "../../util.js";

const PLAYTYPES = ["SP", "DP"];
const VERSIONS = ["world", "konaste", "a3", "a20plus", "a20", "a"];
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

const ptFolders = {};

MutateCollection("folders.json", (foldersCol) => {
	for (const ver of VERSIONS) {
		for (const level of LEVELS) {
			const folder = {
				data: {
					level,
					versions: ver,
				},
				game: "ddr",
				inactive: false,
				searchTerms: [],
				title: `Level ${level} (${ver})`,
				type: "charts",
			};

			for (const playtype of PLAYTYPES) {
				const folderID = CreateFolderID(folder.data, folder.game, playtype);

				const realFolder = Object.assign({ folderID, playtype }, folder);

				if (!ptFolders[playtype]) {
					ptFolders[playtype] = [];
				}

				if (!ptFolders[playtype][ver]) {
					ptFolders[playtype][ver] = [];
				}
				ptFolders[playtype][ver].push(realFolder);

				if (foldersCol.filter((folder) => folder.folderID === folderID).length === 0) {
					foldersCol.push(realFolder);
				}
			}
		}
	}
	return foldersCol;
});

MutateCollection("tables.json", (tables) => {
	for (const playtype of PLAYTYPES) {
		for (const ver of VERSIONS) {
			const tableID = `ddr-${playtype}-${ver}`;
			if (tables.filter((table) => table.tableID === tableID).length === 0) {
				tables.push({
					default: false,
					description: `Levels for DDR (${playtype}) in ${ver}`,
					folders: ptFolders[playtype][ver].map((e) => e.folderID),
					game: "ddr",
					inactive: false,
					playtype,
					tableID: `ddr-${playtype}-${ver}`,
					title: `DDR (${playtype}) (${ver})`,
				});
			}
		}
	}
	return tables;
});
