import {
	MutateCollection,
	ReadCollection,
	WriteCollection,
	CreateLegacyFolderID,
} from "../../util.js";

import { CreateTableID, CreateFolderID } from "/tachi/typescript/common/src/utils/tachi-id.ts";

const GAME = "maimaidx";
const PLAYTYPES = ["Single"];
const VERSION = "CiRCLE Omnimix";
const VERSIONID = "circle-omni";
const TITLE = `maimai DX (${VERSION})`;
const SHORTTITLE = `${VERSIONID}-levels`;
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

MutateCollection("folders.json", (folders) => {
	for (const level of LEVELS) {
		const data = {
			level,
			versions: VERSIONID,
		};

		const slugLevel = level.replace("+", "p");
		const slug = `${slugLevel}-${VERSIONID}`;

		for (const playtype of PLAYTYPES) {
			const folder = {
				game: GAME,
				id: CreateFolderID(),
				inactive: false,
				legacyFolderID: CreateLegacyFolderID(data, GAME, playtype),
				searchTerms: [],
				slug,
				title: `Level ${level} (${VERSION})`,
				versionFilter: [VERSIONID],
				where: `chart.level = '${level}'`,
			};

			if (!ptFolders[playtype]) {
				ptFolders[playtype] = [];
			}

			ptFolders[playtype].push(folder);
			folders.push(folder);
		}
	}

	return folders;
});

const tables = ReadCollection("tables.json");

for (const playtype of PLAYTYPES) {
	const legacyTableID = `${GAME}-${playtype}-${SHORTTITLE}`;

	tables.push({
		default: false,
		description: DESCRIPTION,
		folders: ptFolders[playtype].map((folder) => folder.slug),
		game: GAME,
		id: CreateTableID(),
		inactive: false,
		legacyTableID,
		title: TITLE,
	});
}

WriteCollection("tables.json", tables);
