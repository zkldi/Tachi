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
import { FindSDVXChartOnInGameIDVersion } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { CGContext, CGSDVXScore } from "../types";

import { FormatCGService } from "../util";

export const ConverterAPICGSDVX: ConverterFunction<CGSDVXScore, CGContext> = async (
	data,
	context,
	importType,
	log,
) => {
	const difficulty = ConvertDifficulty(data.difficulty);
	const version = ConvertVersion(data.version);

	const chart = await FindSDVXChartOnInGameIDVersion(data.internalId, difficulty, version);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${data.internalId} (${difficulty} - Version ${version})`,
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

	const lamp = ConvertCGSDVXLamp(version, data.clearType);

	const timeAchieved = ParseDateFromString(data.dateTime);

	const dryScore: DryScore<"sdvx"> = {
		comment: null,
		game: "sdvx",
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
				exScore: data.exScore === 0 ? null : data.exScore,
			},
		},
		scoreMeta: {},
	};

	return { song, chart, dryScore };
};

function ConvertDifficulty(diff: number) {
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

function ConvertVersion(ver: number): Versions["sdvx"] {
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
		case 7:
			return "nabla";
	}

	throw new InvalidScoreFailure(`Unknown Game Version ${ver}.`);
}

/**
 * Convert CG's clearType enum into a Tachi lamp. Note that what numbers mean what are
 * dependent on what version of the game we're listening for.
 */
export function ConvertCGSDVXLamp(
	gameVersion: Versions["sdvx"],
	clearType: number,
): GetEnumValue<"sdvx", "lamp"> {
	if (gameVersion === "nabla") {
		switch (clearType) {
			case 1:
				return "FAILED";
			case 2:
				return "CLEAR";
			case 3:
				return "EXCESSIVE CLEAR";
			case 4:
				return "MAXXIVE CLEAR";
			case 5:
				return "ULTIMATE CHAIN";
			case 6:
				return "PERFECT ULTIMATE CHAIN";
		}
	}

	switch (clearType) {
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

	throw new InvalidScoreFailure(`Invalid lamp of ${clearType} - Could not convert.`);
}
