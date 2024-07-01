import chalk from "chalk";
import fs from "fs";
import path from "path";
import { ReadCollection } from "../util";
import { FormatFunctions } from "./test-utils";
import { ChartDocument, Game, GPTStrings, SongDocument } from "tachi-common";

type TestFn<T> = (self: T) => boolean;
type Test<T> = {
	fn: TestFn<T>;
	desc: string;
};

function test<T>(desc: string, fn: TestFn<T>): Test<T> {
	return { desc, fn };
}

const CHART_CHECKS: { [G in Game]?: Array<Test<ChartDocument<GPTStrings[G]>>> } = {
	iidx: [
		test("Level should not be 0", (c) => c.level !== "0"),
		test(
			"LevelNum should be an integer greater than 0 if level is known",
			(c) =>	c.level === "?" || c.levelNum > 0
		),
		test(
			"Level and LevelNum should align",
			(c) => (c.level === "?" && c.levelNum === 0) || c.level === c.levelNum.toString()
		),
	],
	chunithm: [
		test("Level should not be 0", (c) => c.level !== "0"),
		test("LevelNum should be a number greater than 0", (c) => c.levelNum > 0),
		test(
			"Level and LevelNum should align (X+ should be X.5 or higher)",
			(c) => {
				if (c.level.endsWith("+")) {
					return c.levelNum * 10 % 10 >= 5
				} else {
					return c.levelNum * 10 % 10 < 5
				}
			},
		),
		test(
			"inGameID should not exceed 8000, which is reserved for WORLD'S END charts.",
			(c) => c.data.inGameID === null || c.data.inGameID < 8000,
		)
	],
	maimaidx: [
		test("Level should not be 0", (c) => c.level !== "0"),
		test("LevelNum should be an number greater than 0", (c) => c.levelNum > 0),
		test("inGameID for ST charts should be smaller than 10000",
			(c) => {
				if (c.difficulty.startsWith("DX")) {
					return true;
				}

				return c.data.inGameID === null || c.data.inGameID < 10000;
			},
		),
		test(
			"inGameID for DX charts should be between 10000 (inclusive) and 20000 (exclusive)",
			(c) => {
				if (!c.difficulty.startsWith("DX")) {
					return true;
				}

				if (c.data.inGameID === null) {
					return true;
				}

				return c.data.inGameID >= 10000 && c.data.inGameID < 20000;
			},
		),
		test(
			"inGameID should not exceed 100000, which is reserved for UTAGE charts.",
			(c) => c.data.inGameID === null || c.data.inGameID < 100000,
		),
	],
};

const SONG_CHECKS: { [G in Game]?: Array<Test<SongDocument<G>>> } = {};

let exitCode = 0;
const suites: Array<{ name: string; good: boolean; report: unknown }> = [];

const collections = fs
	.readdirSync(path.join(__dirname, "../../collections"))
	.map((e) => path.basename(e).replace(/\.json$/u, ""));

for (const collection of collections) {
	console.log(`[CUSTOM VALIDATING] ${collection}`);

	let success = 0;
	let fails = 0;

	const collectionName = `${collection}.json`;
	const formatFn = FormatFunctions[collection] ?? ((v) => JSON.stringify(v));

	const data = ReadCollection(collectionName, true);

	let game = "";

	let checks;

	if (collection.startsWith("songs-")) {
		checks = SONG_CHECKS;
	} else if (collection.startsWith("charts-")) {
		checks = CHART_CHECKS;
	} else {
		continue;
	}

	const maybeGame = collection.split("-")[1];

	if (maybeGame === undefined) {
		throw new Error(`Collection passed was literally ${collection}, why?`);
	}

	game = maybeGame;

	for (const d of data) {
		let failed = false;

		const pretty = formatFn(d, game as Game);

		for (const check of checks[game as Game] ?? []) {
			if (!check.fn(d)) {
				console.error(
					chalk.red(
						`[ERR] ${collectionName} | ${check.desc} | ${pretty}`,
					)
				);
				failed = true;
			}
		}

		if (failed) {
			fails += 1;
		} else {
			success += 1;
		}
	}

	const report = `GOOD: ${success}, BAD: ${fails}(${Math.min(
		(success * 100) / fails,
		100
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
	console.log(chalk[suite.good ? "green" : "red"](`[CUSTOM] ${suite.name}: ${suite.report}`));
}

process.exit(exitCode);
