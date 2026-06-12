import { type GameUtility } from "#types/game";
import { type V3Game } from "tachi-common";

import { JubilityBreakdownInsight } from "./insights/JubilityBreakdownInsight";
import {
	ONGEKIClassicBreakdownInsight,
	ONGEKIRefreshBreakdownInsight,
} from "./insights/ONGEKIBreakdownInsight";
import { BMSCustomTablesTool } from "./tools/BMSCustomTablesTool";
import { BMSSieglindeInfoTool } from "./tools/BMSSieglindeInfoTool";
import { IIDXEamusementExportTool } from "./tools/IIDXEamusementExportTool";
import { IIDXPlaylistsTool } from "./tools/IIDXPlaylistsTool";

const GAME_UTILS: Record<V3Game, Array<GameUtility>> = {
	arcaea: [],
	"bms-7k": [BMSCustomTablesTool, BMSSieglindeInfoTool],
	"bms-14k": [BMSCustomTablesTool, BMSSieglindeInfoTool],
	chunithm: [],
	"gitadora-dora": [],
	"gitadora-gita": [],
	"iidx-dp": [IIDXEamusementExportTool, IIDXPlaylistsTool],
	"iidx-sp": [IIDXEamusementExportTool, IIDXPlaylistsTool],
	"itg-stamina": [],
	jubeat: [JubilityBreakdownInsight],
	museca: [],
	"pms-controller": [],
	"pms-keyboard": [],
	popn: [],
	sdvx: [],
	"usc-controller": [],
	"usc-keyboard": [],
	wacca: [],
	maimaidx: [],
	maimai: [],
	ongeki: [ONGEKIRefreshBreakdownInsight, ONGEKIClassicBreakdownInsight],
	"ddr-sp": [],
	"ddr-dp": [],
};

export function GetGameUtils(game: V3Game) {
	return GAME_UTILS[game];
}

export function GetGameUtilsName(game: V3Game, isViewingOwnProfile: boolean) {
	const utils = GetGameUtils(game);

	const tools = utils.filter((e) => e.personalUseOnly);
	const insights = utils.filter((e) => e.personalUseOnly !== true);

	if (isViewingOwnProfile) {
		if (tools.length > 0 && insights.length > 0) {
			return "Tools & Insights";
		} else if (insights.length > 0) {
			return "Insights";
		} else if (tools.length > 0) {
			return "Tools";
		}

		return null;
	}

	if (insights.length > 0) {
		return "Insights";
	}

	return null;
}
