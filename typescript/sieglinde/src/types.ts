import type { BMSGames } from "tachi-common";

export interface BMSTablesDataset {
	url: string;
	name: string;
	description: string;
	game: BMSGames;
	prefix: string;
}

export interface CalcReturns {
	md5: string;
	title: string;
	ec: number;
	hc: number;
	ecStr: string;
	hcStr: string;
	baseLevel: string;

	// Internal values for ec/hc metrics; in the case of the v1 calc, these are
	// sigma values.
	ecMetric: number;
	hcMetric: number;

	playcount: number;
	confidence: number;
}
