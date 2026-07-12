import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";

import {
	InternalFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { FindChartOnInGameIDVersion } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { FervidexStaticContext, FervidexStaticScore } from "./types";

import { FERVIDEX_LAMP_LOOKUP, SplitFervidexChartRef } from "../fervidex/converter";

export const ConverterIRFervidexStatic: ConverterFunction<
	FervidexStaticScore,
	FervidexStaticContext
> = async (data, context, importType, log) => {
	// eslint-disable-next-line prefer-const
	let { difficulty, game } = SplitFervidexChartRef(data.chart);

	// Scripted Long used to be an ANOTHER with id 21201
	//
	// now it has an id of 12250 and is a legg.
	// Versions of omnimix prior to oct 2023 depend on this behaviour.
	if (data.song_id === 21201 && difficulty === "ANOTHER") {
		data.song_id = 12250;
		difficulty = "LEGGENDARIA";
	}

	const chart = await FindChartOnInGameIDVersion(game, data.song_id, difficulty, context.version);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${data.song_id} (${game} ${difficulty} Version ${context.version})`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("iidx", chart.song.id);

	if (!song) {
		log.error(`Song ${chart.song.id} (iidx) has no parent song?`);
		throw new InternalFailure(`Song ${chart.song.id} (iidx) has no parent song?`);
	}

	const optional: { bp?: number | null } = {};

	if (data.miss_count !== undefined) {
		optional.bp = data.miss_count === -1 ? null : data.miss_count;
	}

	const dryScore: DryScore<typeof game> = {
		game,
		service: "Fervidex Static",
		comment: null,
		importType: "ir/fervidex-static",
		timeAchieved: null,
		scoreData: {
			score: data.ex_score,
			lamp: FERVIDEX_LAMP_LOOKUP[data.clear_type],
			judgements: {},
			optional,
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};
