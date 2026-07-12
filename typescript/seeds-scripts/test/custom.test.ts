import chalk from "chalk";
import fs from "fs";
import path from "path";
import {
	type ChartDocument,
	type GameGroup,
	type GamesForGroup,
	type SongDocument,
} from "tachi-common";

import { ReadCollection } from "../util";
import { FormatFunctions } from "./test-utils";

type TestFn<T> = (self: T) => boolean;
type FmtFn<T> = (self: T) => string;
type Test<T> = {
	desc: string;
	fn: TestFn<T>;
	reason?: FmtFn<T>;
};

function test<T>(desc: string, fn: TestFn<T>, reason?: FmtFn<T>): Test<T> {
	return { desc, fn, reason: reason };
}

// TODO(zk): This is stratified on GameGroup when it
// should really be on Game, alas, poor yorick, I knew
// him well.
const CHART_CHECKS: { [G in GameGroup]?: Array<Test<ChartDocument<GamesForGroup[G]>>> } = {
	iidx: [
		test("Level should not be 0", (c) => c.level !== "0"),
		test("LevelNum should be an integer greater than 0 if level is known", (c) =>
			c.level === "?" || c.levelNum > 0),
		test("Level and LevelNum should align", (c) =>
			(c.level === "?" && c.levelNum === 0) || c.level === c.levelNum.toString()),
		test("Worldrecord should not exceed MAX", (c) =>
			c.data.worldRecord === null || c.data.worldRecord <= c.data.notecount * 2),
		test("KaidenAvg should not exceed MAX", (c) =>
			c.data.kaidenAverage === null || c.data.kaidenAverage <= c.data.notecount * 2),
		test("KaidenAvg should not exceed WR", (c) =>
			c.data.kaidenAverage === null ||
			c.data.worldRecord === null ||
			c.data.kaidenAverage < c.data.worldRecord),
	],
	chunithm: [
		test("Level should not be 0", (c) => c.level !== "0"),
		test("LevelNum should be a number greater than 0", (c) => {
			if (Array.isArray(c.data.inGameID) && c.data.inGameID.every((id) => id >= 8000)) {
				return true;
			}

			if (!Array.isArray(c.data.inGameID) && c.data.inGameID >= 8000) {
				return true;
			}

			return c.levelNum > 0;
		}),
		test("Level and LevelNum should align (X+ should be X.5 or higher)", (c) => {
			if (Array.isArray(c.data.inGameID) && c.data.inGameID.every((id) => id >= 8000)) {
				return true;
			}

			if (!Array.isArray(c.data.inGameID) && c.data.inGameID >= 8000) {
				return true;
			}

			if (c.level.endsWith("+")) {
				return (c.levelNum * 10) % 10 >= 5;
			} else {
				return (c.levelNum * 10) % 10 < 5;
			}
		}),
	],
	maimaidx: [
		test("Level should not be 0", (c) => c.level !== "0"),
		test("LevelNum should be an number greater than 0", (c) => c.levelNum > 0),
		test("inGameID for ST charts should be smaller than 10000", (c) => {
			if (c.difficulty.startsWith("DX")) {
				return true;
			}

			return c.data.inGameID === null || c.data.inGameID < 10000;
		}),
		test("inGameID for DX charts should be between 10000 (inclusive) and 20000 (exclusive)", (c) => {
			if (!c.difficulty.startsWith("DX")) {
				return true;
			}

			if (c.data.inGameID === null) {
				return true;
			}

			return c.data.inGameID >= 10000 && c.data.inGameID < 20000;
		}),
		test("inGameID should not exceed 100000, which is reserved for UTAGE charts.", (c) =>
			c.data.inGameID === null || c.data.inGameID < 100000),
		test(
			"Levels equal to 6 and lower don't have a plus variant.",
			(c) => c.levelNum >= 7 || !c.level.endsWith("+"),
			(c) => c.levelNum.toString(),
		),
	],
	wacca: [
		test(
			"Levels <0.7 is not plus.",
			(c) => {
				if ((c.levelNum * 10) % 10 < 7) {
					return !c.level.endsWith("+");
				}

				return true;
			},
			(c) => c.levelNum.toString(),
		),
		test(
			"Levels >=0.7 should end in a +.",
			(c) => {
				if ((c.levelNum * 10) % 10 >= 7) {
					return c.level.endsWith("+");
				}

				return true;
			},
			(c) => c.levelNum.toString(),
		),
	],
	ongeki: [
		test("Level and LevelNum should align (X+ should be X.7 or higher)", (c) => {
			if (c.level.endsWith("+")) {
				return (c.levelNum * 10) % 10 >= 7;
			} else {
				return (c.levelNum * 10) % 10 < 7;
			}
		}),
		test("Charts 12+ and above should have chart view links", (c) => {
			if (c.levelNum === 0.0 || c.levelNum >= 12.7) {
				if (c.data.chartViewURL === undefined) {
					console.log(chalk.yellow(`Missing chartViewURL: ${c.chartID}`));
				}
			}
			return true;
		}),
		test("Bonus tracks must be in the ID range 7000~7999", (c) => {
			if (c.data.isBonusTrack) {
				return (
					c.data.inGameID === null || (c.data.inGameID >= 7000 && c.data.inGameID < 8000)
				);
			}
			return true;
		}),
	],
};

const SONG_CHECKS: { [G in GameGroup]?: Array<Test<SongDocument<G>>> } = {};

let exitCode = 0;
const suites: Array<{ good: boolean; name: string; report: unknown }> = [];

const collections = fs
	.readdirSync(path.join(__dirname, "../../../db/seeds"))
	.filter((e) => e.endsWith(".json"))
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

		const pretty = formatFn(d, game as GameGroup);

		for (const check of checks[game as GameGroup] ?? []) {
			if (!check.fn(d)) {
				console.error(
					chalk.red(
						`[ERR] ${collectionName} | ${check.desc} | ${pretty}${
							check.reason ? ` | Got ${check.reason(d)}` : ""
						}`,
					),
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
	console.log(chalk[suite.good ? "green" : "red"](`[CUSTOM] ${suite.name}: ${suite.report}`));
}

process.exit(exitCode);
