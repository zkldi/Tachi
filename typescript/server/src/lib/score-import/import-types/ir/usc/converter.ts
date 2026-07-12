import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { USCClientScore } from "#server/router/ir/usc/_playtype/types";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	USC_DEFAULT_HOLD,
	USC_DEFAULT_MISS,
	USC_DEFAULT_NEAR,
	USC_DEFAULT_PERFECT,
	USC_DEFAULT_SLAM,
} from "#lib/constants/usc-ir";
import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { FindUSCChartOnSHA1 } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";
import { type GamesForGroup } from "tachi-common";

import type { IRUSCContext } from "./types";

/**
 * Interprets the "note mod" used based on the USC score.
 */
export function DeriveNoteMod(data: USCClientScore): "MIR-RAN" | "MIRROR" | "NORMAL" | "RANDOM" {
	if (data.options.mirror && data.options.random) {
		return "MIR-RAN";
	} else if (data.options.mirror) {
		return "MIRROR";
	} else if (data.options.random) {
		return "RANDOM";
	}

	return "NORMAL";
}

/**
 * Determines the lamp of a USC score.
 */
export function DeriveLamp(scoreDoc: USCClientScore): GetEnumValue<GamesForGroup["usc"], "lamp"> {
	if (scoreDoc.score === 10_000_000) {
		return "PERFECT ULTIMATE CHAIN";
	} else if (scoreDoc.error === 0) {
		return "ULTIMATE CHAIN";
	}

	switch (scoreDoc.options.gaugeType) {
		case 0:
			return scoreDoc.gauge >= 0.7 ? "CLEAR" : "FAILED";
		case 1:
			return scoreDoc.gauge > 0 ? "EXCESSIVE CLEAR" : "FAILED";
		case 2:
			return "FAILED";
		default:
			throw new Error(`Invalid gaugeType of ${scoreDoc.options.gaugeType}.`);
	}
}

function ConvertGaugeType(gaugeType: 0 | 1 | 2) {
	switch (gaugeType) {
		case 0:
			return "NORMAL";
		case 1:
			return "HARD";
		case 2:
			return "PERMISSIVE";
		default:
			throw new Error(`Invalid gaugeType of ${gaugeType}.`);
	}
}

export const ConverterIRUSC: ConverterFunction<USCClientScore, IRUSCContext> = async (
	data,
	context,
	importType,
	log,
) => {
	if (
		data.windows.perfect !== USC_DEFAULT_PERFECT ||
		data.windows.good !== USC_DEFAULT_NEAR ||
		data.windows.hold !== USC_DEFAULT_HOLD ||
		data.windows.miss !== USC_DEFAULT_MISS ||
		data.windows.slam !== USC_DEFAULT_SLAM
	) {
		log.info(
			{
				windows: data.windows,
			},
			`Ignored score because hitWindows were modified.`,
		);
		throw new InvalidScoreFailure(`HitWindows have been modified - Score is invalid.`);
	}

	// if any auto-like option is enabled, reject score.
	if (data.options.autoFlags !== 0) {
		log.debug(`Ignored score because autoplay was enabled.`);
		throw new InvalidScoreFailure(`Autoplay was enabled - Score is invalid.`);
	}

	const game = context.playtype === "Controller" ? "usc-controller" : "usc-keyboard";

	const chartDoc = await FindUSCChartOnSHA1(context.chartHash, game);

	if (!chartDoc) {
		throw new SongOrChartNotFoundFailure(
			`Chart ${context.chartHash} is not on the IR.`,
			"ir/usc",
			data,
			context,
		);
	}

	const song = await FindSongOnID("usc", chartDoc.song.id);

	if (!song) {
		log.error(`Song-Chart desync on USCIR ${chartDoc.song.id}.`);
		throw new InternalFailure(`Song-Chart desync on USCIR ${chartDoc.song.id}.`);
	}

	const lamp = DeriveLamp(data);

	const dryScore: DryScore<typeof game> = {
		comment: null,
		game,
		importType,
		timeAchieved: context.timeReceived,
		service: "USC-IR",
		scoreData: {
			score: data.score,
			lamp,
			judgements: {
				critical: data.crit,
				near: data.near,
				miss: data.error,
			},
			optional: {
				gauge: data.gauge,
				fast: data.early,
				slow: data.late,
				maxCombo: data.combo,
			},
		},
		scoreMeta: {
			gaugeMod: ConvertGaugeType(data.options.gaugeType),
			noteMod: DeriveNoteMod(data),
		},
	};

	return { chart: chartDoc, song, dryScore };
};
