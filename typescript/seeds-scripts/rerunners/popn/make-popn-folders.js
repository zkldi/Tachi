import { Command } from "commander";

import { GetGameConfig } from "../../../common/src/index.ts";
import { CreateFolderID, MutateCollection, CreateTableID } from "../../util.js";
import { Random20Hex } from "../../../server/src/utils/misc.ts";

const tableMainFolders = [];
const tableAllFolders = [];

const program = new Command();
program.requiredOption("-v, --version <version>");

program.parse(process.argv);
const options = program.opts();

//const fmtVersion = GetGamePTConfig("popn", "9B").versions[options.version];
const fmtVersion = GetGameConfig("popn").versions[options.version];

MutateCollection("folders.json", (folders) => {
	for (let i = 0; i < 3; i++) {
		const lb = 10 * i === 0 ? 1 : 10 * i;
		const ub = 10 * (i + 1) - 1;

		const folder = {
			game: "popn",
			inactive: false,
			legacyFolderID: Random20Hex(),
			searchTerms: [],
			slug: `ge-${lb}-le-${ub}-${options.version}`,
			title: `Level ${lb}-${ub} (${fmtVersion})`,
			versionFilter: [options.version],
			where: `chart.level_num >= ${lb} AND chart.level_num <= ${ub}`,
		};

		const folderID = CreateFolderID(folder.data, "popn", "9B");

		folder.id = folderID;

		tableMainFolders.push(folder.slug);
		folders.push(folder);
	}

	for (let i = 1; i <= 50; i++) {
		const folder = {
			game: "popn",
			inactive: false,
			legacyFolderID: Random20Hex(),
			searchTerms: [],
			slug: `${i}-${options.version}`,
			title: `Level ${i} (${fmtVersion})`,
			versionFilter: [options.version],
			where: `chart.level = '${i}'`,
		};

		const folderID = CreateFolderID(folder.data, "popn", "9B");

		folder.id = folderID;

		if (i > 30) {
			tableMainFolders.push(folder.slug);
		}

		tableAllFolders.push(folder.slug);

		folders.push(folder);
	}

	return folders;
});

MutateCollection("tables.json", (tables) => {
	tables.push({
		default: false,
		description: `All pop'n ${fmtVersion} levels individually.`,
		folders: tableAllFolders,
		game: "popn",
		id: CreateTableID(),
		inactive: false,
		legacyTableID: `popn-9B-${options.version}-alllevels`,
		title: `Pop'n Music ${fmtVersion} All Levels`,
	});

	tables.push({
		default: false,
		description: `All pop'n ${fmtVersion} levels, with some folders joined together.`,
		folders: tableMainFolders,
		game: "popn",
		inactive: false,
		id: CreateTableID(),
		legacyTableID: `popn-9B-${options.version}-levels`,
		title: `Pop'n Music ${fmtVersion} Levels`,
	});

	return tables;
});
