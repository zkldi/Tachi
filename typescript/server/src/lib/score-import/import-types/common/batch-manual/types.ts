import type { V3Game, Versions } from "tachi-common";

export interface BatchManualContext {
	game: V3Game;
	version: Versions[V3Game] | null;
	service: string;
}
