import chalk from "chalk";
import {
	ChartDocument,
	FormatGame,
	Game,
	GetGameConfig,
	GetGamePTConfig,
	MatchTypes,
	Playtype,
	SongDocument,
	allSupportedGames,
} from "tachi-common";
import { ReadCollection } from "../util";

// check that a given matchType works for a given game.
const uniquenessChecks: Array<{ game: Game; playtype: Playtype; matchType: MatchTypes }> = [];

for (const game of allSupportedGames) {
	for (const playtype of GetGameConfig(game).playtypes) {
		const gptConfig = GetGamePTConfig(game, playtype);

		for (const matchType of gptConfig.supportedMatchTypes) {
			uniquenessChecks.push({ game, playtype, matchType });
		}
	}
}

// Retrieve a unique identifer (or array of identifiers that must be globally unique)
// for this match type to work
const MATCH_TYPE_CHECKS: Record<
	MatchTypes,
	| {
			type: "SONGS";
			fn: (s: any) => string | Array<string>;
	  }
	| {
			type: "CHARTS";
			fn: (c: any) => string | Array<string>;
	  }
> = {
	tachiSongID: { type: "CHARTS", fn: (s) => `${s.songID}-${s.difficulty}` },
	songTitle: {
		type: "SONGS",
		fn: (s) => [s.title.toLowerCase(), ...s.altTitles.map((t: string) => t.toLowerCase())],
	},
	bmsChartHash: {
		type: "CHARTS",
		fn: (c: ChartDocument<"bms:7K" | "bms:14K">) => [c.data.hashMD5, c.data.hashSHA256],
	},
	inGameID: { type: "CHARTS", fn: (c) => `${c.data.inGameID}-${c.difficulty}` },
	inGameStrID: { type: "CHARTS", fn: (c) => `${c.data.inGameStrID}-${c.difficulty}` },
	itgChartHash: { type: "CHARTS", fn: (c) => c.data.hashGSv3 },
	popnChartHash: { type: "CHARTS", fn: (c) => c.data.hashSHA256 },
	sdvxInGameID: {
		type: "CHARTS",
		fn: (c) => {
			let diff = c.difficulty;

			if (["XCD", "HVN", "GRV", "VVD", "INF"].includes(diff)) {
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
};

let exitCode = 0;
const suites: Array<{ name: string; good: boolean; report: unknown }> = [];

for (const { game, matchType, playtype } of uniquenessChecks) {
	const name = `${FormatGame(game, playtype)} ${matchType}`;
	console.log(`[CHECKING MATCHTYPE] ${name}.`);

	const handler = MATCH_TYPE_CHECKS[matchType];

	let success = 0;
	let fails = 0;
	let warns = 0;

	const data =
		handler.type === "CHARTS"
			? ReadCollection(`charts-${game}.json`)
			: ReadCollection(`songs-${game}.json`);

	const uniqueIDs = new Set();
	for (const el of data) {
		// skip non-primaries as they can't really be matched anyway.
		if (handler.type === "CHARTS" && !el.isPrimary) {
			continue;
		}

		if (handler.type === "CHARTS" && el.playtype !== playtype) {
			continue;
		}

		if (
			(matchType === "inGameID" || matchType === "sdvxInGameID") &&
			(el.data.inGameID === null || el.data.inGameID === undefined)
		) {
			console.log(
				chalk.yellow(
					`Chart ID ${el.chartID} (song ID ${el.songID}) cannot be matched using matchType=${matchType} because its inGameID is unknown.`
				)
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
					`Chart ID ${el.chartID} (song ID ${el.songID}) cannot be matched using matchType=${matchType} because its inGameStrID is unknown.`
				)
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
								playtype
							)}. Imports using this song title *will* have their scores rejected.`
						)
					);
					warns++;
				} else {
					console.log(
						chalk.red(
							`ID ${maybeUnique} wasn't unique in ${FormatGame(
								game,
								playtype
							)} (matchType=${matchType}). It needs to be for this matchType to be legal.`
						)
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
		100
	).toFixed(2)}%)`;
	if (fails > 0) {
		console.error(chalk.red(`[FAILED] ${name}. ${report}.`));
		exitCode++;
	} else if (warns > 0) {
		console.error(chalk.yellow(`[GOOD ISH] ${name}. ${report}.`));
	} else {
		console.log(chalk.green(`[GOOD] ${name}. ${report}.`));
	}

	suites.push({ name, report, good: success > 0 && fails === 0 });
}

console.log(`=== Suite Overview ===`);
for (const suite of suites) {
	console.log(chalk[suite.good ? "green" : "red"](`[MATCHTYPES] ${suite.name}: ${suite.report}`));
}

process.exit(exitCode);
