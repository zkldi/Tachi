import type { integer } from "tachi-common";

export interface KaiIIDXScore {
	music_id: integer;
	play_style: "DOUBLE" | "SINGLE";
	difficulty: "ANOTHER" | "BEGINNER" | "HYPER" | "LEGGENDARIA" | "NORMAL";
	version_played: integer;
	lamp: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
	ex_score: integer;

	// -1 => null
	miss_count: integer | null;

	fast_count: integer | null;
	slow_count: integer | null;
	timestamp: string;
}

export interface KaiSDVXScore {
	music_id: integer;
	music_difficulty: 0 | 1 | 2 | 3 | 4;
	played_version: integer;

	// 0 here is 'PLAYED'
	clear_type: 0 | 1 | 2 | 3 | 4;
	score: integer;
	max_chain: integer;
	critical: integer;
	near: integer;
	error: integer | null;
	early: integer | null;
	late: integer | null;
	gauge_type: 0 | 1 | 2 | 3;
	gauge_rate: integer;
	timestamp: string;
}

export interface KaiContext {
	service: "EAG" | "FLO" | "MIN";
}
