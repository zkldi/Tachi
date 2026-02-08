import { FormatCGService } from "../util";
import {
	InternalFailure,
	InvalidScoreFailure,
	SkipScoreFailure,
	SongOrChartNotFoundFailure,
} from "lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "lib/score-import/framework/common/score-utils";
import { FindIIDXChartOnInGameIDVersion } from "utils/queries/charts";
import { FindSongOnID } from "utils/queries/songs";
import type { ConverterFunction } from "../../types";
import type { CGContext, CGIIDXScore } from "../types";
import type { DryScore } from "lib/score-import/framework/common/types";
import type { Versions, Difficulties, integer } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

export const ConverterAPICGIIDX: ConverterFunction<CGIIDXScore, CGContext> = async (
	data,
	context,
	importType,
	logger
) => {
	const version = ConvertVersion(data.version);
	const playtype = data.difficulty.startsWith("S") ? "SP" : "DP";

	let musicID = data.internalId;

	if (data.difficulty === "SPB") {
		throw new SkipScoreFailure(`We don't support BEGINNER charts. Sorry!`);
	}

	let difficulty = ConvertDifficulty(data.difficulty);

	if (OldLeggendariaConversionTable[musicID] !== undefined) {
		musicID = OldLeggendariaConversionTable[musicID]!;

		// This is now definitely a leggendaria.
		difficulty = "LEGGENDARIA";
	}

	const chart = await FindIIDXChartOnInGameIDVersion(musicID, playtype, difficulty, version);

	if (!chart) {
		throw new SongOrChartNotFoundFailure(
			`Could not find chart with songID ${musicID} (${playtype} ${difficulty} - Version ${version})`,
			importType,
			data,
			context
		);
	}

	const song = await FindSongOnID("iidx", chart.songID);

	if (!song) {
		logger.severe(`Song-Chart desync with song ID ${chart.songID} (iidx).`);
		throw new InternalFailure(`Song-Chart desync with song ID ${chart.songID} (iidx).`);
	}

	const lamp = ConvertLamp(data.clearType);

	const timeAchieved = ParseDateFromString(data.dateTime);

	const scoreMeta = ConvertOptions(data.option1, data.option2);

	const dryScore: DryScore<"iidx:DP" | "iidx:SP"> = {
		comment: null,
		game: "iidx",
		importType,
		timeAchieved,
		service: FormatCGService(context.service),
		scoreData: {
			score: data.exScore,
			lamp,
			judgements: {
				pgreat: data.perfectCount,
				great: data.greatCount,
			},
			optional: {
				bp: data.missCount === -1 ? null : data.missCount,
			},
		},
		scoreMeta: {
			assist: ConvertAssist(data.option1),
			gauge: ConvertGauge(data.option1),
			random: ConvertRandom(data.option1, data.option2),
		},
	};

	return { song, chart, dryScore };
};

// LEGGENDARIAs got turned into a real difficulty as of HEROIC VERSE.
// This service still sends the old songIDs when old scores are requested,
// so we need to convert it up.
const OldLeggendariaConversionTable: Record<integer, integer> = {
	// RUGGED ASH† -> RUGGED ASH
	1100: 1017,

	// Clione† -> Clione
	4100: 4005,

	// ABSOLUTE† -> ABSOLUTE
	4101: 4001,

	// RIDE ON THE LIGHT (HI GREAT MIX) † -> RIDE ON THE LIGHT (HI GREAT MIX)
	5100: 5014,

	// RED ZONE† -> RED ZONE
	11100: 11032,

	// spiral galaxy† -> spiral galaxy
	11101: 11012,

	// Little Little Princess† -> Little Little Princess
	12100: 12002,

	// CONTRACT† -> CONTRACT
	13100: 13010,

	// VANESSA† -> VANESSA
	14100: 14009,

	// KAMAITACHI† -> KAMAITACHI
	14101: 14046,

	// ICARUS† -> ICARUS
	15101: 15023,

	// THE DEEP STRIKER† -> THE DEEP STRIKER
	15102: 15007,

	// Blue Rain† -> Blue Rain
	15104: 15004,

	// Wanna Party?† -> Wanna Party?
	15105: 15045,

	// 凛として咲く花の如く† -> 凛として咲く花の如く
	16101: 16050,

	// THANK YOU FOR PLAYING† -> THANK YOU FOR PLAYING
	16102: 16045,

	// naughty girl@Queen's Palace† -> naughty girl@Queen's Palace
	16103: 16031,

	// Kung-fu Empire† -> Kung-fu Empire
	16104: 16015,

	// SOLID STATE SQUAD† -> SOLID STATE SQUAD
	17101: 17060,

	// Golden Palms† -> Golden Palms
	18100: 18025,

	// おおきなこえで† -> おおきなこえで
	18103: 18011,

	// QUANTUM TELEPORTATION† -> QUANTUM TELEPORTATION
	19100: 19063,

	// 朧† -> 朧
	20103: 20100,

	// 仮想空間の旅人たち† -> 仮想空間の旅人たち
	20104: 20039,

	// LUV CAN SAVE U† -> LUV CAN SAVE U
	20105: 20068,

	// Howling† -> Howling
	20106: 20024,

	// 龍と少女とデコヒーレンス† -> 龍と少女とデコヒーレンス
	20107: 20019,

	// Close the World feat.a☆ru†LEGGENDARIA -> Close the World feat. a☆ru
	21100: 21012,

	// Sigmund†LEGGENDARIA -> Sigmund
	21101: 21059,

	// Ancient Scapes†LEGGENDARIA -> Ancient Scapes
	21102: 21069,

	// invoker†LEGGENDARIA -> invoker
	21103: 21073,

	// Feel The Beat†LEGGENDARIA -> Feel The Beat
	21104: 21052,

	// 疾風迅雷†LEGGENDARIA -> 疾風迅雷
	21105: 21048,

	// Verflucht†LEGGENDARIA -> Verflucht
	21106: 21050,

	// 廿† -> 廿
	21107: 21029,

	// CHRONO DIVER -NORNIR-† -> CHRONO DIVER -NORNIR-
	22101: 22008,

	// chrono diver -fragment-† -> chrono diver -fragment-
	22102: 22013,

	// 恋は白帯、サンシロー† -> 恋は白帯、サンシロー
	22103: 22024,

	// Beat Radiance† -> Beat Radiance
	22104: 22027,

	// 超青少年ノ為ノ超多幸ナ超古典的超舞曲† -> 超青少年ノ為ノ超多幸ナ超古典的超舞曲
	22105: 22031,

	// EBONY & IVORY† -> EBONY & IVORY
	22106: 22089,

	// Cosmic Cat† -> Cosmic Cat
	22107: 22006,

	// Damage Per Second† -> Damage Per Second
	23100: 23054,

	// STARLIGHT DANCEHALL† -> STARLIGHT DANCEHALL
	23101: 23031,

	// Amazing Mirage† -> Amazing Mirage
	24100: 24041,

	// 冬椿 ft. Kanae Asaba† -> 冬椿 ft. Kanae Asaba
	24101: 24011,
};

function ConvertDifficulty(difficulty: string): Difficulties["iidx:DP" | "iidx:SP"] {
	switch (difficulty.charAt(2)) {
		case "N":
			return "NORMAL";
		case "H":
			return "HYPER";
		case "A":
			return "ANOTHER";
		case "L":
			return "LEGGENDARIA";
	}

	throw new InvalidScoreFailure(`Unknown difficulty ${difficulty}.`);
}

function ConvertLamp(lamp: integer): GetEnumValue<"iidx:DP" | "iidx:SP", "lamp"> {
	switch (lamp) {
		case 0:
			return "NO PLAY";
		case 1:
			return "FAILED";
		case 2:
			return "ASSIST CLEAR";
		case 3:
			return "EASY CLEAR";
		case 4:
			return "CLEAR";
		case 5:
			return "HARD CLEAR";
		case 6:
			return "EX HARD CLEAR";
		case 7:
			return "FULL COMBO";
	}

	throw new InvalidScoreFailure(`Unknown lamp value ${lamp}.`);
}

function ConvertAssist(
	option1: integer
): "AUTO SCRATCH" | "FULL ASSIST" | "LEGACY NOTE" | "NO ASSIST" {
	// TODO
	return "NO ASSIST";
}

function ConvertGauge(option1: integer): "ASSISTED EASY" | "EASY" | "EX-HARD" | "HARD" | "NORMAL" {
	// TODO
	return "NORMAL";
}

function ConvertRandom(
	option1: integer,
	option2: integer
):
	| "MIRROR"
	| "NONRAN"
	| "R-RANDOM"
	| "RANDOM"
	| "S-RANDOM"
	| [
			"MIRROR" | "NONRAN" | "R-RANDOM" | "RANDOM" | "S-RANDOM",
			"MIRROR" | "NONRAN" | "R-RANDOM" | "RANDOM" | "S-RANDOM"
	  ] {
	// TODO
	return "NONRAN";
}

function ConvertVersion(version: integer): Versions["iidx:DP" | "iidx:SP"] {
	switch (version) {
		case 20:
			return "20";
		case 21:
			return "21";
		case 22:
			return "22";
		case 23:
			return "23";
		case 24:
			return "24";
		case 25:
			return "25";
		case 26:
			return "26";
		case 27:
			return "27-omni";
		case 28:
			return "28-omni";
		case 29:
			return "29-omni";
		case 30:
			return "30-omni";
		case 31:
			return "31-omni";
		case 32:
			return "32-omni";
		case 33:
			return "33";
	}

	throw new InvalidScoreFailure(`Unsupported version ${version}.`);
}
