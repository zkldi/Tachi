import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";
import type { ScoreData } from "tachi-common";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import {
	OngekiClearStatus,
	OngekiComboStatus,
	OngekiLevel,
} from "#proto/generated/ongeki/common_pb";
import { FindOngekiChartOnInGameID } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { MytOngekiScore } from "./types";

const DIFFICULTIES = {
	[OngekiLevel.UNSPECIFIED]: undefined,
	[OngekiLevel.BASIC]: "BASIC",
	[OngekiLevel.ADVANCED]: "ADVANCED",
	[OngekiLevel.EXPERT]: "EXPERT",
	[OngekiLevel.MASTER]: "MASTER",
	[OngekiLevel.LUNATIC]: "LUNATIC",
};

function getNoteLamp(
	comboStatus: number,
	clearStatus: number,
	techScore: number,
): ScoreData<"ongeki">["noteLamp"] | undefined {
	if (
		comboStatus === OngekiComboStatus.UNSPECIFIED ||
		clearStatus === OngekiClearStatus.UNSPECIFIED
	) {
		return undefined;
	}

	if (techScore === 1010000) {
		return "ALL BREAK+";
	}

	if (comboStatus === OngekiComboStatus.ALL_BREAK) {
		return "ALL BREAK";
	}

	if (comboStatus === OngekiComboStatus.FULL_COMBO) {
		return "FULL COMBO";
	}

	if (
		clearStatus === OngekiClearStatus.OVER_DAMAGE ||
		clearStatus === OngekiClearStatus.CLEARED
	) {
		return "CLEAR";
	}

	if (clearStatus === OngekiClearStatus.FAILED) {
		return "LOSS";
	}

	return undefined;
}

const ConvertAPIMytOngeki: ConverterFunction<MytOngekiScore, EmptyObject> = async (
	data,
	_context,
	importType,
	log,
) => {
	if (data.info === undefined || data.judge === undefined) {
		throw new InvalidScoreFailure("Failed to receive score data from MYT API");
	}

	const difficulty = DIFFICULTIES[data.info.level];

	if (difficulty === undefined) {
		throw new InvalidScoreFailure(
			`Can't process a score with unspecified difficulty (musicId ${data.info.musicId})`,
		);
	}

	const noteLamp = getNoteLamp(data.info.comboStatus, data.info.clearStatus, data.info.techScore);

	if (noteLamp === undefined) {
		throw new InvalidScoreFailure(
			"Can't process a score with an invalid combo status and/or clear status",
		);
	}

	const chart = await FindOngekiChartOnInGameID("ongeki", data.info.musicId, difficulty);

	if (chart === null) {
		throw new SongOrChartNotFoundFailure(
			`Can't find chart with id ${data.info.musicId} and difficulty ${difficulty}`,
			importType,
			data,
			{},
		);
	}

	const song = await FindSongOnID("ongeki", chart.song.id);

	if (song === null) {
		log.error({ chart }, `Song/chart desync: ${chart.song.id} for chart ${chart.chartID}`);
		throw new InternalFailure(`Song/chart desync: ${chart.song.id} for chart ${chart.chartID}`);
	}

	const dryScore: DryScore<"ongeki"> = {
		service: "MYT",
		game: "ongeki",
		scoreMeta: {},
		timeAchieved: ParseDateFromString(data.info.userPlayDate),
		comment: null,
		importType,
		scoreData: {
			score: data.info.techScore,
			noteLamp,
			bellLamp: data.info.isFullBell ? "FULL BELL" : "NONE",
			platinumScore: data.info.platinumScore,
			judgements: {
				cbreak: data.judge.judgeCriticalBreak,
				break: data.judge.judgeBreak,
				hit: data.judge.judgeHit,
				miss: data.judge.judgeMiss,
			},
			optional: {
				damage: data.judge.damageCount,
				bellCount: data.judge.bellCount,
				totalBellCount: data.judge.totalBellCount,
			},
		},
	};

	return { chart, song, dryScore };
};

export default ConvertAPIMytOngeki;
