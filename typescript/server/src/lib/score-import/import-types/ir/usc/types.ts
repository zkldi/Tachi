import type { LEGACY_Playtypes } from "tachi-common";

export interface IRUSCContext {
	chartHash: string;
	// This has to stay here - for orphan backwards compatibility...
	playtype: LEGACY_Playtypes["usc"];
	timeReceived: number;
}
