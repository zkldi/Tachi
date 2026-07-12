import type { integer } from "tachi-common";

export type CGSupportedGames =
	| "jb" // jubeat
	| "msc" // museca
	| "popn"
	| "sdvx";

export type CGServices = "dev" | "gan" | "nag";

export interface CGScoresResponse<T> {
	success: true;
	data: {
		profile: {
			id: string;
			name: string;
		};
		scores: Array<T>;
	};
}

export interface CGErrorResponse {
	success: false;
	message: string;
}

export interface CGMusecaScore {
	internalId: integer;
	difficulty: integer;
	version: integer;
	score: integer;
	clearType: unknown; // we don't use this
	scoreGrade: unknown; // don't care, don't use
	maxChain: integer;
	critical: integer;
	near: integer;
	error: integer;
	dateTime: string;
}

export interface CGPopnScore {
	internalId: integer;
	difficulty: integer;
	version: integer;
	clearFlag: integer;
	score: integer;
	coolCount: integer;
	greatCount: integer;
	goodCount: integer;
	badCount: integer;
	dateTime: string;
}

export interface CGSDVXScore {
	internalId: integer;
	difficulty: integer;
	version: integer;
	score: integer;
	exScore: integer;
	clearType: integer; // what this means depends on what version of the game
	// we're looking at.
	scoreGrade: unknown; // unused, as we derive it
	maxChain: integer;
	critical: integer;
	near: integer;
	error: integer;
	dateTime: string;
}

export interface CGJubeatScore {
	internalId: integer;
	difficulty: integer;
	version: integer;
	clearFlag: integer; // Weird bitwise field, unused.

	score: integer;
	hardMode: boolean;
	perfectCount: integer;
	greatCount: integer;
	goodCount: integer;
	poorCount: integer;
	missCount: integer;
	musicRate: integer;
	dateTime: string;
}

export interface CGContext {
	service: CGServices;
	userID: integer;
}
