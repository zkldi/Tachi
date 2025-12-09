import type { integer } from "tachi-common";

export interface BeatorajaContext {
	client: "beatoraja" | "lr2oraja";
	chart: BeatorajaChart;

	// unexpectedly necessary for orphan code!
	userID: integer;
	timeReceived: number;
}

export interface BeatorajaChart {
	md5: string;
	sha256: string;
	title: string;
	subtitle: string;
	genre: string;
	artist: string;
	subartist: string;
	total: integer;

	mode: "BEAT_7K" | "BEAT_14K" | "POPN_9K";
	judge: number;
	notes: integer;
	hasRandom: boolean;
	hasUndefinedLN: boolean;
	lntype: -1 | 0 | 1 | 2;
}

export interface BeatorajaScore {
	sha256: string;
	exscore: integer;
	passnotes: integer;
	gauge: number;
	deviceType: "BM_CONTROLLER" | "KEYBOARD" | "MIDI";
	minbp: integer;
	option: integer;

	lntype: 0 | 1;
	clear:
		| "AssistEasy"
		| "Easy"
		| "ExHard"
		| "Failed"
		| "FullCombo"
		| "Hard"
		| "LightAssistEasy"
		| "Max"
		| "NoPlay"
		| "Normal"
		| "Perfect";
	assist: 0;
	maxcombo: integer;

	epg: integer;
	egr: integer;
	egd: integer;
	ebd: integer;
	epr: integer;
	lpg: integer;
	lgr: integer;
	lgd: integer;
	lbd: integer;
	lpr: integer;
	ems: integer;
	lms: integer;

	gaugeHistory:
		| {
				groove: Array<integer>;
				hard: Array<integer>;
				exhard: Array<integer>;
				easy: Array<integer>;
		  }
		| null
		| undefined;
}
