import type { z } from "zod";

import chalk from "chalk";
import { ALL_GAMES, FormatGame, type SEEDS_TABLE_DOCUMENT_SCHEMA } from "tachi-common";

import { ReadCollection } from "../util";

const defaultTableMap = {};

const tables: Array<z.infer<typeof SEEDS_TABLE_DOCUMENT_SCHEMA>> = ReadCollection("tables.json");

let errs = 0;

for (const t of tables) {
	if (t.default && t.inactive) {
		console.log(
			chalk.red(
				`[TABLE-DEFAULT] The default table for ${FormatGame(t.game)} '${
					t.title
				}' is inactive. This is not legal.`,
			),
		);
		errs += 1;
	}

	if (t.default) {
		if (defaultTableMap[t.game]) {
			console.log(
				chalk.red(
					`[TABLE-DEFAULT] There are multiple default tables for ${FormatGame(
						t.game,
					)}. This is not legal.`,
				),
			);
		}

		defaultTableMap[t.game] = true;
	}
}

for (const game of ALL_GAMES) {
	if (!defaultTableMap[game]) {
		console.log(chalk.red(`[TABLE-DEFAULT] There is no default table for ${game}.`));
		errs += 1;
	}
}

if (errs === 0) {
	process.exit(0);
} else {
	process.exit(1);
}
