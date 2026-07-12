import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { Difficulties } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { AssertStrAsPositiveInt } from "#lib/score-import/framework/common/string-asserts";
import { FindChartWithSongDifficulty } from "#utils/queries/charts";
import { FindSongOnTitle } from "#utils/queries/songs";

import type { SDVXEamusementCSVData } from "./types";

const DIFFICULTY_MAP: Map<string, Difficulties["sdvx"]> = new Map([
	["ADVANCED", "ADV"],
	["EXCEED", "XCD"],
	["EXHAUST", "EXH"],
	["GRAVITY", "GRV"],
	["HEAVENLY", "HVN"],
	["INFINITE", "INF"],
	["MAXIMUM", "MXM"],
	["NABLA", "NBL"],
	["NOVICE", "NOV"],
	["ULTIMATE", "ULT"],
	["VIVID", "VVD"],
]);

const LAMP_MAP: Map<string, GetEnumValue<"sdvx", "lamp">> = new Map([
	["COMPLETE", "CLEAR"],
	["EXCESSIVE COMPLETE", "EXCESSIVE CLEAR"],
	["MAXXIVE COMPLETE", "MAXXIVE CLEAR"],
	["PERFECT", "PERFECT ULTIMATE CHAIN"],
	["PLAYED", "FAILED"],
	["ULTIMATE CHAIN", "ULTIMATE CHAIN"],
]);

const ConvertEamSDVXCSV: ConverterFunction<SDVXEamusementCSVData, EmptyObject> = async (
	data,
	context,
	importType,
	log,
) => {
	const song = await FindSongOnTitle("sdvx", data.title);

	if (!song) {
		throw new SongOrChartNotFoundFailure(
			`Could not find song for ${data.title}.`,
			importType,
			data,
			context,
		);
	}

	const difficulty = DIFFICULTY_MAP.get(data.difficulty);

	if (!difficulty) {
		log.info(`Invalid difficulty of ${data.difficulty} provided.`);
		throw new InvalidScoreFailure(`${data.title} - Invalid difficulty of ${data.difficulty}.`);
	}

	const humanisedChartTitle = `${song.title} [${difficulty}]`;

	const chart = await FindChartWithSongDifficulty("sdvx", song.id, difficulty);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart for ${humanisedChartTitle}.`,
			importType,
			data,
			context,
		);
	}

	// disabled now because nabla+exceed csvs cause confusion here
	// if (chart.level !== data.level) {
	// 	throw new InvalidScoreFailure(
	// 		`${humanisedChartTitle} - Should be level ${chart.level}, but found level ${data.level}.`,
	// 	);
	// }

	const score = AssertStrAsPositiveInt(
		data.score,
		`${humanisedChartTitle} - Invalid score of ${data.score}.`,
	);

	if (score > 10_000_000) {
		throw new InvalidScoreFailure(
			`${humanisedChartTitle} - Invalid score of ${data.score} (was greater than 10,000,000).`,
		);
	}

	// n.b. "positive int" here means non-negative, 0 is allowed.
	const exScoreOrZero = AssertStrAsPositiveInt(
		data.exscore,
		`${humanisedChartTitle} - Invalid EX score of ${data.score}.`,
	);

	// It's theoretically possible to get an EX score of 0 on a legit play,
	// but this is also the default value if the PB has no EX score (that is,
	// this song has never been played with S-crit enabled). In this case,
	// we should not set exScore.
	const exScore = exScoreOrZero === 0 ? null : exScoreOrZero;

	const lamp = LAMP_MAP.get(data.lamp);

	if (!lamp) {
		log.info(`Invalid lamp of ${data.lamp} provided.`);
		throw new InvalidScoreFailure(`${humanisedChartTitle} - Invalid lamp of ${data.lamp}.`);
	}

	const dryScore: DryScore<"sdvx"> = {
		service: "e-amusement",
		game: "sdvx",
		scoreMeta: {},

		// No timestamp data :(
		timeAchieved: null,
		comment: null,
		importType,
		scoreData: {
			score,
			lamp,
			judgements: {},
			optional: {
				exScore,
			},
		},
	};

	log.debug(`Returning dryscore with ${dryScore.scoreData.score} for ${humanisedChartTitle}`);

	return { chart, song, dryScore };
};

export default ConvertEamSDVXCSV;
