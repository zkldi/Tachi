import type { DryScore } from "#lib/score-import/framework/common/types";
import type { ConverterFunction } from "#lib/score-import/import-types/common/types";
import type { GamesForGroup, ScoreDocument } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import {
	InternalFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { FindBMSChartOnHash } from "#utils/queries/charts";
import { FindSongOnID } from "#utils/queries/songs";

import type { LR2HookContext, LR2HookScore } from "./types";

export const ConverterLR2Hook: ConverterFunction<LR2HookScore, LR2HookContext> = async (
	data,
	context,
	importType,
	log,
) => {
	const chart = await FindBMSChartOnHash(data.md5);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with md5 ${data.md5}.`,
			importType,
			data,
			context,
		);
	}

	const song = await FindSongOnID("bms", chart.song.id);

	if (!song) {
		log.error(`Song ${chart.song.id} (bms) has no parent song?`);
		throw new InternalFailure(`Song ${chart.song.id} (bms) has no parent song?`);
	}

	const gauge = ConvertGauge(data.playerData.gauge);
	const lamp = ConvertLamp(data.scoreData.lamp);

	const bp: number | null = (() => {
		if (
			data.scoreData.extendedJudgements !== null &&
			data.scoreData.extendedJudgements !== undefined
		) {
			return (
				data.scoreData.bad +
				data.scoreData.poor +
				data.scoreData.notesTotal -
				data.scoreData.extendedJudgements.notesPlayed
			);
		}

		// NOTE: we could count whole BP like above but apparently scoreData.notesPlayed can be wrong after
		// restarting charts. This has not been investigated further.
		return data.scoreData.notesPlayed === data.scoreData.notesTotal
			? data.scoreData.bad + data.scoreData.poor
			: null;
	})();

	const dryScore: DryScore<typeof chart.game> = {
		game: chart.game,
		service: "LR2Hook",
		comment: null,
		importType: "ir/lr2hook",
		timeAchieved:
			data.unixTimestamp !== undefined ? data.unixTimestamp * 1_000 : context.timeReceived,
		scoreData: {
			score: data.scoreData.exScore,
			lamp,
			judgements: {
				pgreat: data.scoreData.pgreat,
				great: data.scoreData.great,
				good: data.scoreData.good,
				bad: data.scoreData.bad,
				poor: data.scoreData.poor,
			},
			optional: {
				bp,
				maxCombo: data.scoreData.maxCombo,
				gauge: data.scoreData.hpGraph[999] ?? 0,
				gaugeHistory: data.scoreData.hpGraph,
				ebd: data.scoreData.extendedJudgements?.ebd,
				lbd: data.scoreData.extendedJudgements?.lbd,
				egd: data.scoreData.extendedJudgements?.egd,
				lgd: data.scoreData.extendedJudgements?.lgd,
				egr: data.scoreData.extendedJudgements?.egr,
				lgr: data.scoreData.extendedJudgements?.lgr,
				epg: data.scoreData.extendedJudgements?.epg,
				lpg: data.scoreData.extendedJudgements?.lpg,
				epr: data.scoreData.extendedJudgements?.epr,
				lpr: data.scoreData.extendedJudgements?.lpr,
				fast: data.scoreData.extendedJudgements?.fast,
				slow: data.scoreData.extendedJudgements?.slow,
				gaugeHistoryEasy: data.scoreData.extendedHpGraphs?.easy,
				gaugeHistoryGroove: data.scoreData.extendedHpGraphs?.groove,
				gaugeHistoryHard: data.scoreData.extendedHpGraphs?.hard,
			},
		},
		scoreMeta: {
			gauge,
			random: chart.game === "bms-7k" ? ConvertRandom(data.playerData.random) : null,
			client: "LR2",
		},
	};

	return { song, chart, dryScore };
};

function ConvertGauge(
	gauge: LR2HookScore["playerData"]["gauge"],
): ScoreDocument<GamesForGroup["bms"]>["scoreMeta"]["gauge"] {
	switch (gauge) {
		case "EASY":
			return "EASY";
		case "GROOVE":
			return "NORMAL";
		// FIXME: these are actually separate gauges from HARD
		case "G-ATTACK":
		case "HAZARD":
		case "P-ATTACK":
		case "HARD":
			return "HARD";
	}
}

function ConvertRandom(
	random: LR2HookScore["playerData"]["random"],
): ScoreDocument<GamesForGroup["bms"]>["scoreMeta"]["random"] {
	switch (random) {
		case "NORAN":
			return "NONRAN";
		case "MIRROR":
			return "MIRROR";
		case "RAN":
			return "RANDOM";
		case "S-RAN":
			return "S-RANDOM";
	}
}

function ConvertLamp(
	lamp: LR2HookScore["scoreData"]["lamp"],
): GetEnumValue<GamesForGroup["bms"], "lamp"> {
	switch (lamp) {
		case "EASY":
			return "EASY CLEAR";
		case "FAIL":
			return "FAILED";
		case "FULL COMBO":
			return "FULL COMBO";
		case "HARD":
			return "HARD CLEAR";
		case "NO PLAY":
			return "NO PLAY";
		case "NORMAL":
			return "CLEAR";
	}
}
