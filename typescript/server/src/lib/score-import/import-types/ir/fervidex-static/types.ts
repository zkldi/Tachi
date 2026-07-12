import type { GamesForGroup, integer, Versions } from "tachi-common";

export interface FervidexStaticScore {
	clear_type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
	ex_score: integer;

	// This refers to BP, not combo breaks.
	miss_count?: integer | null;
	chart: `${"dp" | "sp"}${"a" | "b" | "h" | "l" | "n"}`;
	song_id: integer;
}

export interface FervidexStaticContext {
	version: Versions[GamesForGroup["iidx"]];
}

export interface FervidexStaticHeaders {
	model: string;
	shouldImportScores: boolean;
}
