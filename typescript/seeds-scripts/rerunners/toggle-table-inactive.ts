import { Command } from "commander";
import { MutateCollection, ReadCollection, WriteCollection } from "../util.js";
import { SEEDS_FolderDocument, SEEDS_TableDocument } from "tachi-common";
import { log as logger } from "../log.ts";

const program = new Command();
program.requiredOption("-t, --tableID <id>", "Current table ID or slug");
program.option("-g, --game <game>", "Scope a table slug to a game");

program.parse(process.argv);
const options = program.opts();

const tables = ReadCollection<SEEDS_TableDocument>("tables.json");

const matches = tables.filter(
	(table) =>
		(table.id === options.tableID || table.slug === options.tableID) &&
		(options.game === undefined || table.game === options.game),
);

if (matches.length !== 1) {
	throw new Error(
		matches.length === 0
			? `No such table ${options.tableID} exists.`
			: `Table slug ${options.tableID} is ambiguous; specify --game.`,
	);
}

const table = matches[0]!;
const toggleValue = !table.inactive;
table.inactive = toggleValue;
logger.info(`Toggling table ${table.id} (${table.title}) to inactive=${toggleValue}`);

MutateCollection("folders.json", (folders: SEEDS_FolderDocument[]) => {
	for (const folder of folders) {
		const matchesRef =
			folder.game === table.game &&
			(table.folders.includes(folder.slug) || table.folders.includes(folder.id));

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
