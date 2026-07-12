import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import {
	ChunithmClearStatus,
	ChunithmComboStatus,
	ChunithmLevel,
} from "#proto/generated/chunithm/common_pb";
import { FindChartOnInGameID, FindChartOnInGameIDIfUnique } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { MytChunithmScore } from "./types";

const DIFFICULTIES = {
	[ChunithmLevel.UNSPECIFIED]: undefined,
	[ChunithmLevel.BASIC]: "BASIC",
	[ChunithmLevel.ADVANCED]: "ADVANCED",
	[ChunithmLevel.EXPERT]: "EXPERT",
	[ChunithmLevel.MASTER]: "MASTER",
	[ChunithmLevel.ULTIMA]: "ULTIMA",
	[ChunithmLevel.WORLDS_END]: "WORLD'S END",
};

const CLEAR_LAMPS = {
	[ChunithmClearStatus.UNSPECIFIED]: undefined,
	[ChunithmClearStatus.FAILED]: "FAILED",
	[ChunithmClearStatus.CLEAR]: "CLEAR",
	[ChunithmClearStatus.HARD]: "HARD",
	[ChunithmClearStatus.ABSOLUTE]: "BRAVE",
	[ChunithmClearStatus.ABSOLUTE_PLUS]: "ABSOLUTE",
	[ChunithmClearStatus.CATASTROPHY]: "CATASTROPHY",
} as const;

const NOTE_LAMPS = {
	[ChunithmComboStatus.UNSPECIFIED]: undefined,
	[ChunithmComboStatus.NONE]: "NONE",
	[ChunithmComboStatus.FULL_COMBO]: "FULL COMBO",
	[ChunithmComboStatus.ALL_JUSTICE]: "ALL JUSTICE",
	[ChunithmComboStatus.ALL_JUSTICE_CRITICAL]: "ALL JUSTICE CRITICAL",
} as const;

const ConvertAPIMytChunithm: ConverterFunction<MytChunithmScore, EmptyObject> = async (
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

	const clearLamp = CLEAR_LAMPS[data.info.clearStatus];

	if (clearLamp === undefined) {
		throw new InvalidScoreFailure("Can't process a score with an invalid clear status");
	}

	const noteLamp = NOTE_LAMPS[data.info.comboStatus];

	if (noteLamp === undefined) {
		throw new InvalidScoreFailure("Can't process a score with an invalid combo status");
	}

	const chart =
		data.info.level === ChunithmLevel.WORLDS_END
			? await FindChartOnInGameIDIfUnique("chunithm", data.info.musicId)
			: await FindChartOnInGameID("chunithm", data.info.musicId, difficulty);

	if (chart === null) {
		throw new SongOrChartNotFoundFailure(
			`Can't find chart with id ${data.info.musicId} and difficulty ${difficulty}`,
			importType,
			data,
			{},
		);
	}

	const song = await FindSongOnID("chunithm", chart.song.id);

	if (song === null) {
		log.error({ chart }, `Song/chart desync: ${chart.song.id} for chart ${chart.chartID}`);
		throw new InternalFailure(`Song/chart desync: ${chart.song.id} for chart ${chart.chartID}`);
	}

	const dryScore: DryScore<"chunithm"> = {
		service: "MYT",
		game: "chunithm",
		scoreMeta: {},
		timeAchieved: ParseDateFromString(data.info.userPlayDate),
		comment: null,
		importType,
		scoreData: {
			score: data.info.score,
			clearLamp,
			noteLamp,
			judgements: {
				jcrit: data.judge.judgeCritical + data.judge.judgeHeaven,
				justice: data.judge.judgeJustice,
				attack: data.judge.judgeAttack,
				miss: data.judge.judgeMiss,
			},
			optional: {
				maxCombo: data.judge.maxCombo,
			},
		},
	};

	return { chart, song, dryScore };
};

export default ConvertAPIMytChunithm;
