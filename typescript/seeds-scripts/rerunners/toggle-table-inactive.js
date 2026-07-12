import { Command } from "commander";

import { MutateCollection, ReadCollection, WriteCollection } from "../util.js";

const program = new Command();
program.requiredOption("-t, --tableID <tableID>");

program.parse(process.argv);
const options = program.opts();

const tables = ReadCollection("tables.json");

let table;

for (const findTable of tables) {
	if (findTable.tableID === options.tableID) {
		table = findTable;
		findTable.inactive = !findTable.inactive;
		break;
	}
}

if (!table) {
	throw new Error(`No such table ${options.tableID} exists.`);
}

MutateCollection("folders.json", (folders) => {
	for (const folder of folders) {
		const id = folder.folderID ?? folder.id;
		const matchesRef =
			(folder.slug !== undefined && table.folders.includes(folder.slug)) ||
			(id !== undefined && table.folders.includes(id));

		if (matchesRef) {
			folder.inactive = !folder.inactive;
		}
	}

	return folders;
});

WriteCollection("tables.json", tables);
