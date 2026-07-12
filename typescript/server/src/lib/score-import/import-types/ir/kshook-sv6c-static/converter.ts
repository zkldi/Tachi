import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { EmptyObject } from "#utils/types";

import {
	InternalFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { FindSDVXChartOnInGameIDVersion } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { KsHookSV6CStaticScore } from "./types";

import { SV6CConvertDifficulty, SV6CConvertLamp } from "../kshook-sv6c/converter";

export const ConverterKsHookSV6CStatic: ConverterFunction<
	KsHookSV6CStaticScore,
	EmptyObject
> = async (data, context, importType, log) => {
	const diff = SV6CConvertDifficulty(data.difficulty);

	const chart = await FindSDVXChartOnInGameIDVersion(data.music_id, diff, "konaste");

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${data.music_id} (${diff} for Konaste).`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("sdvx", chart.song.id);

	if (!song) {
		log.error(`Song ${chart.song.id} (sdvx) has no parent song?`);
		throw new InternalFailure(`Song ${chart.song.id} (sdvx) has no parent song?`);
	}

	const dryScore: DryScore<"sdvx"> = {
		game: "sdvx",
		service: "kshook SV6C Static",
		comment: null,
		importType: "ir/kshook-sv6c",
		timeAchieved: data.timestamp * 1000,
		scoreData: {
			score: data.score,
			lamp: SV6CConvertLamp(data.clear),
			judgements: {},
			optional: {
				maxCombo: data.max_chain,
				exScore: data.ex_score,
			},
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};
