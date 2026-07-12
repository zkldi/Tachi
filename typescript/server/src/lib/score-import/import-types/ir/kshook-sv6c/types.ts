import type { integer } from "tachi-common";

export interface KsHookSV6CScore {
	clear:
		| "CLEAR_EFFECTIVE"
		| "CLEAR_EXCESSIVE"
		| "CLEAR_MAXXIVE"
		| "CLEAR_PERFECT"
		| "CLEAR_PLAYED"
		| "CLEAR_ULTIMATE_CHAIN";
	difficulty: `DIFFICULTY_${"ADVANCED" | "EXHAUST" | "INFINITE" | "MAXIMUM" | "NOVICE"}`;
	gauge: integer;
	grade: `GRADE_${
		| "A"
		| "A_PLUS"
		| "AA"
		| "AA_PLUS"
		| "AAA"
		| "AAA_PLUS"
		| "B"
		| "C"
		| "D"
		| "S"}`;
	max_chain: integer;
	music_id: integer;

	critical: integer;
	near: integer;
	error: integer;

	rate: `RATE_${"BLASTIVE" | "EFFECTIVE" | "EXCESSIVE" | "PERMISSIVE"}`;
	score: integer;
	ex_score: integer;

	track_no: integer;
	retry_count: unknown;
}

export interface KsHookSV6CContext {
	timeReceived: number;
}
