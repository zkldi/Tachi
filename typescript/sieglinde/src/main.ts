import type { CalcReturns } from "#types";

import SieglindeV1Calc from "#calc/v1-jiminp";
import { Command } from "commander";
import fs from "fs";
import path from "path";

import GetTableData from "./fetch-tables";
import logger from "./logger";

const program = new Command();

program.requiredOption("-p, --playtype <7K or 14K>");

program.parse(process.argv);
const options = program.opts();

if (require.main !== module) {
	logger.error(`The script main.ts must be invoked directly!`);
	process.exit(-1);
}

void (async () => {
	const calcFn = SieglindeV1Calc;

	fs.mkdirSync(`${__dirname}/cache`, { recursive: true });

	const PLAYTYPE_TO_GAME: Record<string, "bms-7k" | "bms-14k"> = {
		"7K": "bms-7k",
		"14K": "bms-14k",
	};
	const game = PLAYTYPE_TO_GAME[options.playtype];

	if (!game) {
		throw new Error(`Unknown playtype '${options.playtype}'. Expected '7K' or '14K'.`);
	}

	const tableInfo = await GetTableData(game);

	logger.info(`Starting...`);

	let i = 1;

	fs.mkdirSync(path.join(__dirname, "output"), { recursive: true });

	for (const table of tableInfo) {
		logger.info(`Running for table ${table.table.name}. ${i}/${tableInfo.length}`);

		// literally all the parallelism in this codebase has to be turned off because
		// the lr2ir runs off of a toaster which attempts to gut you if you make more than one
		// request a second.
		// eslint-disable-next-line no-await-in-loop
		const data = await calcFn(table);

		fs.writeFileSync(
			path.join(__dirname, `output/${table.table.name}.json`),
			JSON.stringify(data),
		);

		fs.writeFileSync(path.join(__dirname, `output/${table.table.name}.csv`), toCSV(data));

		i++;
	}

	logger.info(`Finished!`);
})();

function toCSV(calcData: Array<CalcReturns>) {
	let str = `"md5","title","baseLevel","ec","ecStr","hc","hcStr","playcount","confidence"\n`;

	for (const data of calcData) {
		const row = [
			data.md5,
			data.title.replace(/"/gu, '""'),
			data.baseLevel,
			data.ec,
			data.ecStr,
			data.hc,
			data.hcStr,
			data.playcount,
			data.confidence,
		];

		str = `${str}"${row.join('","')}"\n`;
	}

	return str;
}
