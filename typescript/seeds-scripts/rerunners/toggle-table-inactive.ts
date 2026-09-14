import { Command } from "commander";
import { MutateCollection, ReadCollection, WriteCollection } from "../util.js";
import { SEEDS_FolderDocument, SEEDS_TableDocument } from "tachi-common";
import { log as logger } from "../log.ts";

const program = new Command();
program.requiredOption("-t, --tableID <id>");

program.parse(process.argv);
const options = program.opts();

const tables = ReadCollection<SEEDS_TableDocument>("tables.json");

let table;

let toggleValue: boolean;

for (const findTable of tables) {
	let targetID;
	if (/^T[0-9a-fA-F]+$/u.test(options.tableID)) {
		targetID = findTable.id;
	} else {
		targetID = findTable.legacyTableID;
	}

	if (options.tableID === targetID) {
		table = findTable;
		findTable.inactive = !findTable.inactive;
		toggleValue = findTable.inactive;
		logger.info(`Toggling table  ${table.id} (${table.title}) to inactive=${toggleValue}`);
		break;
	}
}

if (!table) {
	throw new Error(`No such table ${options.tableID} exists.`);
}

MutateCollection("folders.json", (folders: SEEDS_FolderDocument[]) => {
	for (const folder of folders) {
		const matchesRef =
			(folder.slug !== undefined && table.folders.includes(folder.slug)) ||
			(folder.id !== undefined && table.folders.includes(folder.id));

		if (matchesRef) {
			folder.inactive = toggleValue;
			logger.info(`Toggling folder ${folder.id} (${folder.title})`);
		}
	}

	return folders;
});

if (table.default === true && toggleValue! === true) {
	logger.warn(`${table.id} has been deactivated, but it is currently the default table.`);
}

WriteCollection("tables.json", tables);
