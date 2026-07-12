import chalk from "chalk";
import {
	ALL_GAMES,
	type ChartDocument,
	FormatGame,
	GameToGameGroup,
	GetGameConfig,
	type MatchTypes,
	type SongDocument,
	type V3Game,
} from "tachi-common";

import { ReadCollection } from "../util";

// check that a given matchType works for a given game.
const uniquenessChecks: Array<{ game: V3Game; matchType: MatchTypes }> = [];

for (const game of ALL_GAMES) {
	const gameConfig = GetGameConfig(game);

	for (const matchType of gameConfig.supportedMatchTypes) {
		// `gcmInGameIDSpecialChart` resolves only when an in-game ID is held by a single chart;
		// normal GCM charts intentionally share IDs across difficulties, so a global uniqueness
		// check like the other match types does not apply.
		if (matchType === "gcmInGameIDSpecialChart") {
			continue;
		}

		uniquenessChecks.push({ game, matchType });
	}
}

// Retrieve a unique identifer (or array of identifiers that must be globally unique)
// for this match type to work
const MATCH_TYPE_CHECKS: Record<
	MatchTypes,
	| {
			fn: (c: any) => string | Array<string>;
			type: "CHARTS";
	  }
	| {
			fn: (s: any) => string | Array<string>;
			type: "SONGS";
	  }
> = {
	tachiSongID: { type: "CHARTS", fn: (s) => `${s.songID}-${s.difficulty}` },
	songTitle: {
		type: "SONGS",
		fn: (s) => [s.title.toLowerCase(), ...s.altTitles.map((t: string) => t.toLowerCase())],
	},
	bmsChartHash: {
		type: "CHARTS",
		fn: (c: ChartDocument<"bms-7k" | "bms-14k">) => [c.data.hashMD5, c.data.hashSHA256],
	},
	inGameID: { type: "CHARTS", fn: (c) => `${c.data.inGameID}-${c.difficulty}` },
	inGameStrID: { type: "CHARTS", fn: (c) => `${c.data.inGameStrID}-${c.difficulty}` },
	itgChartHash: { type: "CHARTS", fn: (c) => c.data.hashGSv3 },
	popnChartHash: { type: "CHARTS", fn: (c) => c.data.hashSHA256 },
	sdvxInGameID: {
		type: "CHARTS",
		fn: (c) => {
			let diff = c.difficulty;

			if (["GRV", "HVN", "INF", "VVD", "XCD"].includes(diff)) {
				diff = "ANY_INF";
			}

			return `${c.data.inGameID}-${diff}`;
		},
	},
	uscChartHash: { type: "CHARTS", fn: (c) => c.data.hashSHA1 },
	ddrSongHash: {
		type: "SONGS",
		fn: (s: SongDocument<"ddr">) => {
			// if there's no ddrSongHash then it's a konaste song / we're missing seed data
			// so just use the inGameID
			if (s.data.ddrSongHash === undefined) {
				return `${s.data.inGameID}`;
			}
			return s.data.ddrSongHash;
		},
	},
	gcmInGameIDSpecialChart: {
		type: "CHARTS",
		// redundant - no check needed
		fn: (c: ChartDocument) => c.chartID,
	},
};

let exitCode = 0;
const suites: Array<{ good: boolean; name: string; report: unknown }> = [];

for (const { game, matchType } of uniquenessChecks) {
	const name = `${FormatGame(game)} ${matchType}`;
	console.log(`[CHECKING MATCHTYPE] ${name}.`);

	const handler = MATCH_TYPE_CHECKS[matchType];

	let success = 0;
	let fails = 0;
	let warns = 0;

	const data =
		handler.type === "CHARTS"
			? ReadCollection(`charts-${game}.json`)
			: ReadCollection(`songs-${GameToGameGroup(game)}.json`);

	const uniqueIDs = new Set();
	for (const el of data) {
		// skip non-primaries as they can't really be matched anyway.
		if (handler.type === "CHARTS" && !el.isPrimary) {
			continue;
		}

		if (
			(matchType === "inGameID" || matchType === "sdvxInGameID") &&
			(el.data.inGameID === null || el.data.inGameID === undefined)
		) {
			console.log(
				chalk.yellow(
					`Chart ID ${el.chartID} (song ID ${el.songID}) cannot be matched using matchType=${matchType} because its inGameID is unknown.`,
				),
			);
			warns++;
			continue;
		}

		if (
			matchType === "inGameStrID" &&
			el.data.inGameStrID === null &&
			el.data.inGameStrID === undefined
		) {
			console.log(
				chalk.yellow(
					`Chart ID ${el.chartID} (song ID ${el.songID}) cannot be matched using matchType=${matchType} because its inGameStrID is unknown.`,
				),
			);
			warns++;
			continue;
		}

		let newUniqueThingies = handler.fn(el);

		// make single returns into arrays. convenient.
		if (!Array.isArray(newUniqueThingies)) {
			newUniqueThingies = [newUniqueThingies];
		}

		for (const maybeUnique of newUniqueThingies) {
			if (uniqueIDs.has(maybeUnique)) {
				if (matchType === "songTitle") {
					console.log(
						chalk.yellow(
							`Song title ${maybeUnique} wasn't case-insensitively unique in ${FormatGame(
								game,
							)}. Imports using this song title *will* have their scores rejected.`,
						),
					);
					warns++;
				} else {
					console.log(
						chalk.red(
							`ID ${maybeUnique} wasn't unique in ${FormatGame(
								game,
							)} (matchType=${matchType}). It needs to be for this matchType to be legal.`,
						),
					);
					fails++;
				}
			} else {
				success++;
				uniqueIDs.add(maybeUnique);
			}
		}
	}

	const report = `GOOD: ${success}, WARNS: ${warns}, BAD: ${fails}(${Math.min(
		(success * 100) / (success + fails),
		100,
	).toFixed(2)}%)`;
	if (fails > 0) {
		console.error(chalk.red(`[FAILED] ${name}. ${report}.`));
		exitCode++;
	} else if (warns > 0) {
		console.error(chalk.yellow(`[GOOD ISH] ${name}. ${report}.`));
	} else {
		console.log(chalk.green(`[GOOD] ${name}. ${report}.`));
	}

	suites.push({ name, report, good: success >= 0 && fails === 0 });
}

console.log(`=== Suite Overview ===`);
for (const suite of suites) {
	console.log(chalk[suite.good ? "green" : "red"](`[MATCHTYPES] ${suite.name}: ${suite.report}`));
}

process.exit(exitCode);
