import chalk from "chalk";
import fjsh from "fast-json-stable-hash";
import get from "lodash.get";
import {
	ALL_GAMES,
	allSupportedGameGroups,
	type GameGroup,
	GameToGameGroup,
	type integer,
	type V3Game,
} from "tachi-common";

import { GetChartCollectionGame, GetSongCollectionGame, ReadCollection } from "../util";
import { FormatFunctions } from "./test-utils";

// Either it's a bare string or an array of strings for co-uniqueness.
type DuplicateKeyDecl = string | string[];

function chartDupKeyDecls(): DuplicateKeyDecl[] {
	return [
		"id",
		"legacyChartID",
		// @todo THIS IS WRONG. CHARTS ARE ALLOWED TO HAVE MULTIPLE
		// SONGID+DIFFICULTY COMBOS IF ISPRIMARY IS FALSE.
		["songID", "difficulty", "isPrimary"],
	];
}

const SongChartKeys: Record<string, DuplicateKeyDecl[]> = {};

for (const gameGroup of allSupportedGameGroups) {
	SongChartKeys[`songs-${gameGroup}`] = ["id", "legacySongID"];
}

for (const v3Game of ALL_GAMES) {
	SongChartKeys[`charts-${v3Game}`] = chartDupKeyDecls();
}

const UniqueKeys: Record<string, DuplicateKeyDecl[]> = {
	"bms-course-lookup": [["set", "game", "value"]],
	folders: ["id", "legacyFolderID"],
	tables: ["id", "legacyTableID"],
	questlines: ["questlineID"],
	quests: ["questID"],
	goals: ["goalID"],
	...SongChartKeys,
};

for (const v3 of ["usc-keyboard", "usc-controller"] as const) {
	UniqueKeys[`charts-${v3}`]!.push("data.hashSHA1");
}

UniqueKeys["charts-popn"]!.push("data.hashSHA256");

for (const v3 of ["bms-7k", "bms-14k"] as const) {
	UniqueKeys[`charts-${v3}`]!.push("data.hashMD5");
	UniqueKeys[`charts-${v3}`]!.push("data.hashSHA256");
}

for (const v3 of ["pms-keyboard", "pms-controller"] as const) {
	UniqueKeys[`charts-${v3}`]!.push("data.hashMD5");
	UniqueKeys[`charts-${v3}`]!.push("data.hashSHA256");
}

UniqueKeys["charts-itg-stamina"]!.push("data.hashGSv3");

let exitCode = 0;
const suites: Array<{ good: boolean; name: string; report: unknown }> = [];

/**
 * Turns [[A B], [C], [D E]] into
 * [A C D], [A C E], [B C D], [B C E]
 *
 * https://github.com/izaakschroeder/cartesian-product/blob/master/lib/product.js
 */
function cartesianProduct(elements: Array<Array<unknown>>) {
	const end = elements.length - 1;
	const result: Array<Array<unknown>> = [];

	function addTo(curr: Array<unknown>, start: integer) {
		const first = elements[start]!;
		const last = start === end;

		for (let i = 0; i < first.length; ++i) {
			const copy = curr.slice();
			copy.push(first[i]);

			if (last) {
				result.push(copy);
			} else {
				addTo(copy, start + 1);
			}
		}
	}

	if (elements.length > 0) {
		addTo([], 0);
	} else {
		result.push([]);
	}

	return result;
}

function gameGroupForFormat(collection: string): GameGroup {
	if (collection.startsWith("songs-")) {
		return GetSongCollectionGame(`${collection}.json`) as GameGroup;
	}

	if (collection.startsWith("charts-")) {
		const v3Game = GetChartCollectionGame(`${collection}.json`) as V3Game;

		return GameToGameGroup(v3Game);
	}

	throw new Error(`Expected songs-* or charts-* collection, got ${collection}`);
}

for (const [collection, uniqueIDs] of Object.entries(UniqueKeys)) {
	console.log(`[VALIDATING DUPES] ${collection}`);

	const collectionName = `${collection}.json`;
	const formatFn = FormatFunctions[collectionName] ?? ((v) => JSON.stringify(v));

	let success = 0;
	let fails = 0;

	const data = ReadCollection(collectionName, true);

	let gameGroupForFmt: GameGroup | null = null;

	if (collection.startsWith("songs-") || collection.startsWith("charts-")) {
		gameGroupForFmt = gameGroupForFormat(collection);
	}

	for (const uniqueID of uniqueIDs) {
		const set = new Set<string>();
		for (const d of data) {
			const pretty = formatFn(d, gameGroupForFmt);

			let value: Array<Array<number | string>>;

			// insane parallelisation code
			if (Array.isArray(uniqueID)) {
				const mappedProps = uniqueID.map((e) => get(d, e));

				// Charts are special and can be a duplicate if it's not primary
				if (collection.startsWith("charts-")) {
					if (mappedProps[uniqueID.lastIndexOf("isPrimary")] === false) {
						success++;
						continue;
					}
				}

				value = mappedProps;
			} else {
				value = [get(d, uniqueID)];
			}

			// debugging
			for (const v of value) {
				if (v === undefined) {
					console.error(
						chalk.red(
							`[ERR] ${collectionName} | ${pretty} | ${uniqueID} is undefined, the key referenced here is wrong.`,
						),
					);
				}
			}

			const valueCells = value.flatMap((e) => (Array.isArray(e) ? e : [e]));
			if (valueCells.some((cell) => cell === undefined)) {
				// Optional seed fields (e.g. PMS hashes): cannot enforce uniqueness.
				continue;
			}

			// cartesian product values before we interact with them.
			const values = cartesianProduct(value.map((e) => (Array.isArray(e) ? e : [e]))).map(
				(e) => ({
					value: fjsh.hash(e, "sha256"),
					humanisedValue: e.map((e) => String(e)).join(", "),
				}),
			);

			for (const { value, humanisedValue } of values) {
				// Null is special -- we're allowed duplicates of null for some
				// keys.
				if (set.has(value)) {
					console.error(
						chalk.red(
							`[ERR] ${collectionName} | ${pretty} | Is duplicate on ${uniqueID}:${humanisedValue}.`,
						),
					);
					fails++;
				} else {
					success++;
					set.add(value);
				}
			}
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
	console.log(chalk[suite.good ? "green" : "red"](`[DUPES] ${suite.name}: ${suite.report}`));
}

process.exit(exitCode);
