import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { Difficulties, integer, Versions } from "tachi-common";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import { FindChartOnInGameID } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { CGContext, CGJubeatScore } from "../types";

import { FormatCGService } from "../util";

export const ConverterAPICGJubeat: ConverterFunction<CGJubeatScore, CGContext> = async (
	data,
	context,
	importType,
	log,
) => {
	const difficulty = ConvertDifficulty(data.difficulty, data.hardMode);
	const version = ConvertVersion(data.version);
	const musicRate = ConvertMusicRate(data.musicRate);
	const judgements = {
		perfect: data.perfectCount,
		great: data.greatCount,
		good: data.goodCount,
		poor: data.poorCount,
		miss: data.missCount,
	};
	const lamp = GetLamp(data.clearFlag);

	const chart = await FindChartOnInGameID("jubeat", data.internalId, difficulty);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with internalId ${data.internalId} (${difficulty} - Version ${version})`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("jubeat", chart.song.id);

	if (!song) {
		log.error(`Song-Chart desync with song ID ${chart.song.id} (jubeat).`);
		throw new InternalFailure(`Song-Chart desync with song ID ${chart.song.id} (jubeat).`);
	}

	const timeAchieved = ParseDateFromString(data.dateTime);

	const dryScore: DryScore<"jubeat"> = {
		comment: null,
		game: "jubeat",
		importType,
		timeAchieved,
		service: FormatCGService(context.service),
		scoreData: {
			score: data.score,
			musicRate,
			lamp,
			judgements,
			optional: {},
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};

function ConvertDifficulty(diff: number, hardMode: boolean): Difficulties["jubeat"] {
	if (!hardMode) {
		switch (diff) {
			case 0:
				return "BSC";
			case 1:
				return "ADV";
			case 2:
				return "EXT";
		}
	} else {
		switch (diff) {
			case 0:
				return "HARD BSC";
			case 1:
				return "HARD ADV";
			case 2:
				return "HARD EXT";
		}
	}

	throw new InvalidScoreFailure(`Invalid difficulty of ${diff} - Could not convert.`);
}

function ConvertVersion(ver: number): Versions["jubeat"] {
	switch (ver) {
		case 1:
			return "jubeat";
		case 2:
			return "ripples";
		case 3:
			return "knit";
		case 4:
			return "copious";
		case 5:
			return "saucer";
		case 6:
			return "prop";
		case 7:
			return "qubell";
		case 8:
			return "clan";
		case 9:
		case 10: // special case for omni
			return "festo";
		case 11:
			return "ave";
		case 12:
			return "beyond";
	}

	throw new InvalidScoreFailure(`Unknown Game Version ${ver}.`);
}

function ConvertMusicRate(rate: number): number {
	return rate / 10;
}

function GetLamp(clearFlag: integer) {
	if ((clearFlag & (1 << 3)) !== 0) {
		return "EXCELLENT";
	}

	if ((clearFlag & (1 << 2)) !== 0) {
		return "FULL COMBO";
	}

	if ((clearFlag & (1 << 1)) !== 0) {
		return "CLEAR";
	}

	if ((clearFlag & (1 << 0)) !== 0) {
		return "FAILED";
	}

	throw new InvalidScoreFailure("Failed to decode Lamp using bitfield clearFlag.");
}
