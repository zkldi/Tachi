import type { Game, Versions, GPTString, Playtype } from "tachi-common";

export interface BatchManualContext {
	game: Game;
	playtype: Playtype;
	version: Versions[GPTString] | null;
	service: string;
}
