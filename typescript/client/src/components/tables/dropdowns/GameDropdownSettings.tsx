import { GameToGameGroup, type V3Game } from "tachi-common";

import { BMSGraphsComponent } from "./components/BMSScoreDropdownParts";
import { ChunithmGraphsComponent } from "./components/ChunithmScoreDropdownParts";
import { IIDXGraphsComponent } from "./components/IIDXScoreDropdownParts";
import { ITGGraphsComponent } from "./components/ITGScoreDropdownParts";
import { JubeatGraphsComponent } from "./components/JubeatScoreDropdownParts";
import { MaimaiDXGraphsComponent } from "./components/MaimaiDXScoreDropdownParts";
import { OngekiGraphsComponent } from "./components/OngekiScoreDropdownParts";

export function GameDropdownSettings(game: V3Game): any {
	const gameGroup = GameToGameGroup(game);

	if (gameGroup === "iidx") {
		return {
			renderScoreInfo: true,
			// let the record show that i tried fixing this
			// for a while, but gave up.
			GraphComponent: IIDXGraphsComponent as any,
		};
	} else if (gameGroup === "bms") {
		return {
			renderScoreInfo: true,
			GraphComponent: BMSGraphsComponent as any,
		};
	} else if (gameGroup === "itg") {
		return {
			renderScoreInfo: true,
			GraphComponent: ITGGraphsComponent as any,
		};
	} else if (gameGroup === "jubeat") {
		return {
			renderScoreInfo: true,
			GraphComponent: JubeatGraphsComponent as any,
		};
	} else if (gameGroup === "ongeki") {
		return {
			renderScoreInfo: true,
			GraphComponent: OngekiGraphsComponent as any,
		};
	} else if (gameGroup === "chunithm") {
		return {
			renderScoreInfo: true,
			GraphComponent: ChunithmGraphsComponent as any,
		};
	} else if (gameGroup === "maimaidx") {
		return {
			renderScoreInfo: true,
			GraphComponent: MaimaiDXGraphsComponent as any,
		};
	}

	return {};
}
