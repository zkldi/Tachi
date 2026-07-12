import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { Difficulties, Versions } from "tachi-common";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { MusecaGetLamp, ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import { FindChartOnInGameIDVersion } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { CGContext, CGMusecaScore } from "../types";

import { FormatCGService } from "../util";

export const ConverterAPICGMuseca: ConverterFunction<CGMusecaScore, CGContext> = async (
	data,
	context,
	importType,
	log,
) => {
	const difficulty = ConvertDifficulty(data.difficulty);
	const version = ConvertVersion(data.version);

	const chart = await FindChartOnInGameIDVersion("museca", data.internalId, difficulty, version);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${data.internalId} (${difficulty} - Version ${version})`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("museca", chart.song.id);

	if (!song) {
		log.error(`Song-Chart desync with song ID ${chart.song.id} (museca).`);
		throw new InternalFailure(`Song-Chart desync with song ID ${chart.song.id} (museca).`);
	}

	const lamp = MusecaGetLamp(data.score, data.error);

	const timeAchieved = ParseDateFromString(data.dateTime);

	const dryScore: DryScore<"museca"> = {
		comment: null,
		game: "museca",
		importType,
		timeAchieved,
		service: FormatCGService(context.service),
		scoreData: {
			score: data.score,
			lamp,
			judgements: {
				critical: data.critical,
				near: data.near,
				miss: data.error,
			},
			optional: {
				maxCombo: data.maxChain,
			},
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};

function ConvertDifficulty(diff: number): Difficulties["museca"] {
	switch (diff) {
		case 0:
			return "Green";
		case 1:
			return "Yellow";
		case 2:
			return "Red";
	}

	throw new InvalidScoreFailure(`Invalid difficulty of ${diff} - Could not convert.`);
}

function ConvertVersion(ver: number): Versions["museca"] {
	switch (ver) {
		case 2:
			return "1.5-b";
	}

	throw new InvalidScoreFailure(`Unknown/Unsupported Game Version ${ver}.`);
}
