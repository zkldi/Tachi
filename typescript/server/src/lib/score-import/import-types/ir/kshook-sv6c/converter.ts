import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { FindSDVXChartOnInGameIDVersion } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { KsHookSV6CContext, KsHookSV6CScore } from "./types";

export const ConverterIRKsHookSV6C: ConverterFunction<KsHookSV6CScore, KsHookSV6CContext> = async (
	data,
	context,
	importType,
	log,
) => {
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
		service: "kshook SV6C",
		comment: null,
		importType: "ir/kshook-sv6c",
		timeAchieved: context.timeReceived,
		scoreData: {
			score: data.score,
			lamp: SV6CConvertLamp(data.clear),
			judgements: {
				critical: data.critical,
				near: data.near,
				miss: data.error,
			},
			optional: {
				gauge: data.gauge / 100,
				maxCombo: data.max_chain,
				exScore: data.ex_score,
			},
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};

export function SV6CConvertLamp(clear: KsHookSV6CScore["clear"]): GetEnumValue<"sdvx", "lamp"> {
	switch (clear) {
		case "CLEAR_PLAYED":
			return "FAILED";
		case "CLEAR_EFFECTIVE":
			return "CLEAR";
		case "CLEAR_EXCESSIVE":
			return "EXCESSIVE CLEAR";
		case "CLEAR_ULTIMATE_CHAIN":
			return "ULTIMATE CHAIN";
		case "CLEAR_PERFECT":
			return "PERFECT ULTIMATE CHAIN";
		case "CLEAR_MAXXIVE":
			return "MAXXIVE CLEAR";
	}

	throw new InvalidScoreFailure(`Invalid lamp of ${clear} - Could not convert.`);
}

export function SV6CConvertDifficulty(
	diff: KsHookSV6CScore["difficulty"],
): "ADV" | "ANY_INF" | "EXH" | "MXM" | "NOV" {
	if (diff === "DIFFICULTY_NOVICE") {
		return "NOV";
	} else if (diff === "DIFFICULTY_ADVANCED") {
		return "ADV";
	} else if (diff === "DIFFICULTY_EXHAUST") {
		return "EXH";
	} else if (diff === "DIFFICULTY_INFINITE") {
		return "ANY_INF";
	}

	return "MXM";
}
