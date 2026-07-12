import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { Difficulties } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import { type WaccaClearStatus, WaccaMusicDifficulty } from "#proto/generated/wacca/common_pb";
import { FindChartOnInGameID } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { MytWaccaScore } from "./types";

const DIFFICULTIES: Partial<Record<WaccaMusicDifficulty, Difficulties["wacca"]>> = {
	[WaccaMusicDifficulty.UNSPECIFIED]: undefined,
	[WaccaMusicDifficulty.NORMAL]: "NORMAL",
	[WaccaMusicDifficulty.HARD]: "HARD",
	[WaccaMusicDifficulty.EXPERT]: "EXPERT",
	[WaccaMusicDifficulty.INFERNO]: "INFERNO",
};

function convertClearStatus(status: WaccaClearStatus | undefined): GetEnumValue<"wacca", "lamp"> {
	if (status === undefined) {
		throw new InvalidScoreFailure(`Can't process a score without clearStatus`);
	}

	if (status.isAllMarvelous) {
		return "ALL MARVELOUS";
	}

	if (status.isFullCombo) {
		return "FULL COMBO";
	}

	if (status.isMissless) {
		return "MISSLESS";
	}

	if (status.isClear) {
		return "CLEAR";
	}

	// Give up and failed are handled the same.
	return "FAILED";
}

const ConvertAPIMytWACCA: ConverterFunction<MytWaccaScore, EmptyObject> = async (
	data,
	_context,
	importType,
	log,
) => {
	const difficulty = DIFFICULTIES[data.musicDifficulty];

	if (difficulty === undefined) {
		throw new InvalidScoreFailure(
			`Can't process a score with unspecified difficulty (musicId ${data.musicId})`,
		);
	}

	const chart = await FindChartOnInGameID("wacca", data.musicId, difficulty);

	if (chart === null) {
		throw new SongOrChartNotFoundFailure(
			`Can't find chart with id ${data.musicId} and difficulty ${difficulty}`,
			importType,
			data,
			{},
		);
	}

	const song = await FindSongOnID("wacca", chart.song.id);

	if (song === null) {
		log.error({ chart }, `Song/chart desync: ${chart.song.id} for chart ${chart.chartID}`);
		throw new InternalFailure(`Song/chart desync: ${chart.song.id} for chart ${chart.chartID}`);
	}

	const lamp = convertClearStatus(data.clearStatus);
	const timeAchieved = ParseDateFromString(data.userPlayDate);

	const dryScore: DryScore<"wacca"> = {
		service: "MYT",
		game: "wacca",
		scoreMeta: {},

		timeAchieved,
		comment: null,
		importType,
		scoreData: {
			score: data.score,
			lamp,
			judgements: {
				marvelous: data.judge?.marvelous,
				great: data.judge?.great,
				good: data.judge?.good,
				miss: data.judge?.miss,
			},
			optional: {
				fast: data.fast,
				slow: data.late,
				maxCombo: data.combo,
			},
		},
	};

	return { chart, song, dryScore };
};

export default ConvertAPIMytWACCA;
