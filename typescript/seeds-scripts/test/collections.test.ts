import chalk from "chalk";
import fs from "fs";
import path from "path";
import { type GameGroup, GameToGameGroup } from "tachi-common";
import { z } from "zod";

import { GetChartCollectionGame, GetSongCollectionGame, ReadCollection } from "../util";
import { type AllCollections, V3_SCHEMAS } from "./schemas";
import { FormatFunctions } from "./test-utils";

function FormatPrError(err, foreword = "Error") {
	const receivedText =
		typeof err.userVal === "object" && err.userVal !== null
			? ""
			: ` | Received ${err.userVal} [${err.userVal === null ? "null" : typeof err.userVal}]`;

	return `${foreword}: ${err.keychain} | ${err.message}${receivedText}.`;
}

let exitCode = 0;
const suites: Array<{ good: boolean; name: string; report: unknown }> = [];

const collections = fs
	.readdirSync(path.join(__dirname, "../../../db/seeds"))
	.filter((e) => e.endsWith(".json"))
	.map((e) => path.basename(e)) as Array<AllCollections>;

for (const collection of collections) {
	console.log(`[VALIDATING] ${collection}`);

	let success = 0;
	let fails = 0;

	const formatFn = FormatFunctions[collection] ?? ((v) => JSON.stringify(v));

	const data = ReadCollection(collection, true);

	const validator = V3_SCHEMAS[collection];

	let gameGroup = "";

	if (collection.startsWith("songs-")) {
		const maybeGameGroup = GetSongCollectionGame(collection);

		if (maybeGameGroup === undefined) {
			throw new Error(`Collection passed was literally ${collection}, why?`);
		}

		gameGroup = maybeGameGroup;
	} else if (collection.startsWith("charts-")) {
		const maybeGame = GetChartCollectionGame(collection);

		if (maybeGame === undefined) {
			throw new Error(`Collection passed was literally ${collection}, why?`);
		}

		gameGroup = GameToGameGroup(maybeGame);
	}

	for (const d of data) {
		// Will throw if formatFn is undefined -- that's a test failure in my book.
		const pretty = formatFn(d, gameGroup as GameGroup);

		const result = validator.safeParse(d);

		if (!result.success) {
			console.error(
				chalk.red(`[ERR] ${collection} | ${pretty} | ${z.prettifyError(result.error)}.`),
			);
			fails++;
		} else {
			success++;
		}
	}

	const report = `GOOD: ${success}, BAD: ${fails}(${Math.min(
		(success * 100) / fails,
		100,
	).toFixed(2)}%)`;
	if (fails > 0) {
		console.error(chalk.red(`[FAILED] ${collection}. ${report}.`));
		exitCode++;
	} else {
		console.log(chalk.green(`[GOOD] ${collection}. ${report}.`));
	}

	suites.push({ name: collection, report, good: fails === 0 });
}

console.log(`=== Suite Overview ===`);
for (const suite of suites) {
	console.log(chalk[suite.good ? "green" : "red"](`[SCHEMAS] ${suite.name}: ${suite.report}`));
}

process.exit(exitCode);
