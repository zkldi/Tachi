import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "../../../framework/common/converter-failures";
import { HandleOrphanQueue } from "lib/orphan-queue/orphan-queue";
import { DeorphanScores } from "lib/score-import/framework/orphans/orphans";
import { ServerConfig, TachiConfig } from "lib/setup/config";
import { Random20Hex } from "utils/misc";
import { FindChartOnSHA256, FindChartOnSHA256Playtype } from "utils/queries/charts";
import { FindSongOnID } from "utils/queries/songs";
import type { DryScore } from "../../../framework/common/types";
import type { ConverterFunction } from "../../common/types";
import type { BeatorajaChart, BeatorajaContext, BeatorajaScore } from "./types";
import type { KtLogger } from "lib/logger/logger";
import type { ChartDocument, SongDocument, Playtypes } from "tachi-common";
import type { Mutable } from "utils/types";

const LAMP_LOOKUP = {
	NoPlay: "NO PLAY",
	Failed: "FAILED",
	AssistEasy: "ASSIST CLEAR",
	LightAssistEasy: "ASSIST CLEAR",
	Easy: "EASY CLEAR",
	Normal: "CLEAR",
	Hard: "HARD CLEAR",
	ExHard: "EX HARD CLEAR",
	FullCombo: "FULL COMBO",
	Perfect: "FULL COMBO",
	Max: "FULL COMBO",
} as const;

const RANDOM_LOOKUP = {
	0: "NONRAN",
	1: "MIRROR",
	2: "RANDOM",
	3: "R-RANDOM",
	4: "S-RANDOM",
} as const;

async function HandleOrphanChartProcess(
	game: "bms" | "pms",
	data: BeatorajaScore,
	context: BeatorajaContext,
	logger: KtLogger
) {
	const chartName = `${context.chart.artist} (${context.chart.subartist})- ${context.chart.title} (${context.chart.subtitle})`;

	// -1: unspecified in chart
	// 0: force-LN
	// 1: force-CN
	// 2: force-HCN
	if (context.chart.lntype !== 0 && context.chart.lntype !== -1) {
		throw new InvalidScoreFailure(
			`${TachiConfig.NAME} does not support charts with forced-CN or forced-HCN.`
		);
	}

	if (context.chart.hasRandom) {
		// If you're someone forking tachi looking to remove this
		// check, remember to change the entire score import
		// framework and database to be able to handle variable notecounts.
		logger.verbose(`Declined to orphan chart ${chartName} as it has #RANDOM declarations.`);
		throw new InvalidScoreFailure(`${TachiConfig.NAME} will not support #RANDOM charts.`);
	}

	let chart;
	let criteria;

	if (game === "bms") {
		criteria = {
			"chartDoc.data.hashSHA256": context.chart.sha256,
		};

		const gptString = context.chart.mode === "BEAT_7K" ? "bms:7K" : "bms:14K";

		const { chartDoc, songDoc } = ConvertBeatorajaChartToTachi(
			context.chart,
			context.chart.mode === "BEAT_7K" ? "7K" : "14K"
		);

		// only try and insert this in the tachi DB if it has a valid MD5.
		// beatoraja makes it **perfectly valid** for MD5 to be an empty string
		// if it doesn't feel like md5ing the chart (for whatever reason)
		if (chartDoc.data.hashMD5.length === "d0f497c0f955e7edfb0278f446cdb6f8".length) {
			chart = await HandleOrphanQueue(
				gptString,
				"bms",
				chartDoc,
				songDoc,
				criteria,
				ServerConfig.BEATORAJA_QUEUE_SIZE,
				context.userID,
				chartName
			);
		}
	} else {
		const playtype = data.deviceType === "BM_CONTROLLER" ? "Controller" : "Keyboard";

		criteria = {
			"chartDoc.data.hashSHA256": context.chart.sha256,
			playtype,
		};

		const gptString = playtype === "Controller" ? "pms:Controller" : "pms:Keyboard";

		const { chartDoc, songDoc } = ConvertBeatorajaChartToTachi(context.chart, playtype);

		// only try and insert this in the tachi DB if it has a valid MD5.
		// beatoraja makes it **perfectly valid** for MD5 to be an empty string
		// if it doesn't feel like md5ing the chart (for whatever reason)
		if (chartDoc.data.hashMD5.length === "d0f497c0f955e7edfb0278f446cdb6f8".length) {
			chart = await HandleOrphanQueue(
				gptString,
				"pms",
				chartDoc,
				songDoc,
				criteria,
				ServerConfig.BEATORAJA_QUEUE_SIZE,
				context.userID,
				chartName
			);
		}
	}

	// If chart wasn't unorphaned as a result of this request
	// orphan this score and return ktdnf
	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`This chart (${context.chart.artist} - ${context.chart.title}) is orphaned.`,
			"ir/beatoraja",
			data,
			context
		);
	}

	await DeorphanScores(criteria, logger);

	return chart;
}

// NOTE: This converter handles both PMS and BMS scores. The two are very similar,
// infact, beatoraja barely does anything different between the two. PMS is essentially
// BMS but with the columns set to 9.
export const ConverterIRBeatoraja: ConverterFunction<BeatorajaScore, BeatorajaContext> = async (
	data,
	context,
	importType,
	logger
) => {
	// ALWAYS USE CHART.LNTYPE, NOT DATA.LNTYPE!
	// beatoraja has a bug where IRScore LNTypes are always set to 0.
	if (context.chart.lntype !== 0) {
		throw new InvalidScoreFailure("CN or HCN mode is not supported by this IR.");
	}

	if (context.chart.hasRandom) {
		throw new InvalidScoreFailure(
			"Charts with #RANDOM declarations are not supported by this IR."
		);
	}

	const game = context.chart.mode === "POPN_9K" ? "pms" : "bms";

	let chart: ChartDocument<"bms:7K" | "bms:14K" | "pms:Controller" | "pms:Keyboard"> | null;

	if (game === "bms") {
		chart = (await FindChartOnSHA256(game, data.sha256)) as ChartDocument<
			"bms:7K" | "bms:14K"
		> | null;
	} else {
		let playtype: Playtypes["pms"];

		// It's still called BM_CONTROLLER even though its popn!
		if (data.deviceType === "BM_CONTROLLER") {
			playtype = "Controller";
		} else if (data.deviceType === "KEYBOARD") {
			playtype = "Keyboard";
		} else {
			throw new InvalidScoreFailure("MIDI is not allowed for PMS scores.");
		}

		chart = (await FindChartOnSHA256Playtype(game, data.sha256, playtype)) as ChartDocument<
			"pms:Controller" | "pms:Keyboard"
		> | null;
	}

	if (!chart) {
		chart = await HandleOrphanChartProcess(game, data, context, logger);
	}

	const song = await FindSongOnID(game, chart.songID);

	if (!song) {
		logger.severe(`Song-Chart Desync with ${game} ${chart.chartID}.`);
		throw new InternalFailure(`Song-Chart Desync with ${game} ${chart.chartID}.`);
	}

	const optional: Mutable<
		DryScore<"bms:7K" | "bms:14K" | "pms:Controller" | "pms:Keyboard">["scoreData"]["optional"]
	> = {
		bp: data.minbp === -1 ? null : data.minbp,
		gauge: data.gauge === -1 ? null : data.gauge,
		gaugeHistoryEasy: data.gaugeHistory?.easy,
		gaugeHistoryGroove: data.gaugeHistory?.groove,
		gaugeHistoryHard: data.gaugeHistory?.hard,
	};

	for (const k of [
		"ebd",
		"lbd",
		"egd",
		"lgd",
		"egr",
		"lgr",
		"epg",
		"lpg",
		"epr",
		"lpr",
	] as const) {
		optional[k] = data[k];
	}

	optional.epr = (optional.epr ?? 0) + data.ems;
	optional.lpr = (optional.lpr ?? 0) + data.lms;

	const judgements = {
		[game === "pms" ? "cool" : "pgreat"]: data.epg + data.lpg,
		great: data.egr + data.lgr,
		good: data.egd + data.lgd,
		bad: data.ebd + data.lbd,
		poor: data.epr + data.lpr + data.ems + data.lms,
	};

	optional.fast = (["ebd", "egr", "epr", "ems"] as const).reduce((a, e) => a + data[e], 0);
	optional.slow = (["lbd", "lgr", "lpr", "lms"] as const).reduce((a, e) => a + data[e], 0);

	let random = null;

	// pms and bms are fine using this randomlookup, except for 14k, which is
	// broken in beatoraja.
	if (chart.playtype !== "14K") {
		if ([0, 1, 2, 3, 4].includes(data.option)) {
			random = RANDOM_LOOKUP[data.option as 0 | 1 | 2 | 3 | 4];
		}
	}

	const lamp = LAMP_LOOKUP[data.clear];

	const dryScore: DryScore<"bms:7K" | "bms:14K" | "pms:Controller" | "pms:Keyboard"> = {
		comment: null,
		game,
		importType,
		scoreData: {
			score: data.exscore,
			lamp,
			optional,
			judgements,
		},
		scoreMeta: {
			client: context.client,
			inputDevice: data.deviceType,

			// silly hack
			// it's complaining that this might be assigned for 14k
			// but it's not because of the conditions under which this is assigned.
			// sorry!
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			random: random as any,
		},
		timeAchieved: context.timeReceived,
		service: "Beatoraja IR",
	};

	return { song, chart, dryScore };
};

function ConvertBeatorajaChartToTachi(chart: BeatorajaChart, playtype: Playtypes["bms" | "pms"]) {
	const chartDoc: ChartDocument<"bms:7K" | "bms:14K" | "pms:Controller" | "pms:Keyboard"> = {
		chartID: Random20Hex(),
		difficulty: "CHART",
		isPrimary: true,
		level: "?",
		levelNum: 0,
		playtype,
		songID: 0,
		versions: [],
		data: {
			hashMD5: chart.md5,
			hashSHA256: chart.sha256,
			notecount: chart.notes,
			tableFolders: [],
			aiLevel: null,
			sglEC: null,
			sglHC: null,
		},
	};

	const songDoc: SongDocument<"bms" | "pms"> = {
		artist: chart.artist,
		title: chart.title,
		id: 0,
		altTitles: [],
		searchTerms: [],
		data: {
			genre: chart.genre,
			subartist: chart.subartist,
			subtitle: chart.subtitle,
			tableString: null,
		},
	};

	return { songDoc, chartDoc };
}
