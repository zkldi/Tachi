import type { GamesForGroup, integer, Versions } from "tachi-common";

export interface BarbatosScore {
	difficulty: 0 | 1 | 2 | 3 | 4;
	level: integer;
	song_id: integer;
	max_chain: integer;
	critical: integer;
	near_total: integer;
	near_fast: integer;
	near_slow: integer;
	score: integer;
	error: integer;
	percent: number;
	did_fail: boolean;
	clear_type: 1 | 2 | 3 | 4 | 5;
	gauge_type: 0 | 1 | 2 | 3;
	is_skill_analyzer: boolean;
}

export interface BarbatosSDVX6Score {
	difficulty: 0 | 1 | 2 | 3 | 4;
	level: integer;
	score: integer;
	ex_score: integer;
	clear_type: 1 | 2 | 3 | 4 | 5;
	song_id: integer;

	grade: unknown; // don't care, we calculate this

	percent: number; // "health"

	max_chain: integer;
	early_error: integer;
	early_near: integer;
	early_crit: integer;
	s_crit: integer;
	late_crit: integer;
	late_near: integer;
	late_error: integer;
	chip_s_crit: integer;
	chip_crit: integer;
	chip_near: integer;
	chip_error: integer;
	long_crit: integer;
	long_error: integer;
	vol_crit: integer;
	vol_error: integer;

	gauge_type: 0 | 1 | 2 | 3;
}

export interface BarbatosContext {
	timeReceived: number;
	version: Versions[GamesForGroup["sdvx"]];
}
