import type { USCInputType } from "#server/router/ir/usc/_playtype/types";

export interface IRUSCContext {
	chartHash: string;
	// This has to stay here - for orphan backwards compatibility...
	playtype: USCInputType;
	timeReceived: number;
}
