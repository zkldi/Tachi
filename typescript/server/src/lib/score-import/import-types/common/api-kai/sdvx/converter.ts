import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { Versions } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import { FormatPrError } from "#utils/prudence";
import { FindSDVXChartOnInGameIDVersion } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";
import { p } from "prudence";

import type { KaiContext, KaiSDVXScore } from "../types";

const PR_KAI_SDVX_SCORE = {
	music_id: p.isPositiveInteger,
	music_difficulty: p.isBoundedInteger(0, 5),
	played_version: p.isBoundedInteger(1, 6),
	clear_type: p.isBoundedInteger(1, 6),
	max_chain: p.isPositiveInteger,
	score: p.isBoundedInteger(0, 10_000_000),
	critical: p.isPositiveInteger,
	near: p.isPositiveInteger,
	error: p.nullable(p.isPositiveInteger),
	early: p.nullable(p.isPositiveInteger),
	late: p.nullable(p.isPositiveInteger),
	gauge_rate: p.isBetween(0, 100),
	timestamp: "string",
};

export const ConvertAPIKaiSDVX: ConverterFunction<unknown, KaiContext> = async (
	data,
	context,
	importType,
	log,
) => {
	const err = p(data, PR_KAI_SDVX_SCORE, {}, { allowExcessKeys: true });

	if (err) {
		throw new InvalidScoreFailure(FormatPrError(err));
	}

	// prudence checks this above.
	const score = data as KaiSDVXScore;

	const difficulty = ConvertDifficulty(score.music_difficulty);
	const version = ConvertVersion(score.played_version);

	const chart = await FindSDVXChartOnInGameIDVersion(score.music_id, difficulty, version);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${score.music_id} (${difficulty} - Version ${version})`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("sdvx", chart.song.id);

	if (!song) {
		log.error(`Song-Chart desync with song ID ${chart.song.id} (sdvx).`);
		throw new InternalFailure(`Song-Chart desync with song ID ${chart.song.id} (sdvx).`);
	}

	const lamp = ResolveKaiLamp(score.clear_type);

	const timeAchieved = ParseDateFromString(score.timestamp);

	const dryScore: DryScore<"sdvx"> = {
		comment: null,
		game: "sdvx",
		importType,
		timeAchieved,
		service: context.service,
		scoreData: {
			score: score.score,
			lamp,
			judgements: {
				critical: score.critical,
				near: score.near,
				miss: score.error,
			},
			optional: {
				fast: score.early,
				slow: score.late,
				gauge: score.gauge_rate,
				maxCombo: score.max_chain,
			},
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};

export function ConvertDifficulty(diff: number) {
	switch (diff) {
		case 0:
			return "NOV";
		case 1:
			return "ADV";
		case 2:
			return "EXH";
		case 3:
			return "ANY_INF";
		case 4:
			return "MXM";
		case 5:
			return "ULT";
	}

	throw new InvalidScoreFailure(`Invalid difficulty of ${diff} - Could not convert.`);
}

export function ConvertVersion(ver: number): Versions["sdvx"] {
	switch (ver) {
		case 1:
			return "booth";
		case 2:
			return "inf";
		case 3:
			return "gw";
		case 4:
			return "heaven";
		case 5:
			return "vivid";
		case 6:
			return "exceed";
	}

	throw new InvalidScoreFailure(`Unknown Game Version ${ver}.`);
}

export function ResolveKaiLamp(clear: number): GetEnumValue<"sdvx", "lamp"> {
	switch (clear) {
		case 1:
			return "FAILED";
		case 2:
			return "CLEAR";
		case 3:
			return "EXCESSIVE CLEAR";
		case 4:
			return "ULTIMATE CHAIN";
		case 5:
			return "PERFECT ULTIMATE CHAIN";
		case 6:
			return "MAXXIVE CLEAR";
	}

	throw new InvalidScoreFailure(`Invalid lamp of ${clear} - Could not convert.`);
}
