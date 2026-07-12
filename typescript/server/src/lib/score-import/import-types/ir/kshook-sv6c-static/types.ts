import type { KsHookSV6CScore } from "../kshook-sv6c/types";

export interface KsHookSV6CStaticScore {
	clear: KsHookSV6CScore["clear"];
	difficulty: KsHookSV6CScore["difficulty"];
	grade: KsHookSV6CScore["grade"];

	ex_score: number;
	max_chain: number;
	music_id: number;
	score: number;
	timestamp: number;
}

export interface KsHookSV6CStaticBody {
	scores: Array<KsHookSV6CStaticScore>;
}
