import type { integer } from "tachi-common";

export interface LR2HookScore {
	md5: string;
	playerData: {
		autoScr: 0;
		gameMode: unknown;
		gauge: "EASY" | "G-ATTACK" | "GROOVE" | "HARD" | "HAZARD" | "P-ATTACK";
		random: "MIRROR" | "NORAN" | "RAN" | "S-RAN";
		rseed: integer | undefined;
	};
	scoreData: {
		bad: integer;
		exScore: integer;
		extendedHpGraphs:
			| {
					easy: Array<integer>;
					gattack: Array<integer>;
					groove: Array<integer>;
					hard: Array<integer>;
					hazard: Array<integer>;
					pattack: Array<integer>;
			  }
			| null
			| undefined;
		extendedJudgements:
			| {
					cb: integer;
					ebd: integer;
					egd: integer;
					egr: integer;
					epg: integer;
					epr: integer;
					fast: integer;
					lbd: integer;
					lgd: integer;
					lgr: integer;
					lpg: integer;
					lpr: integer;
					notesPlayed: integer;
					slow: integer;
			  }
			| null
			| undefined;
		good: integer;
		great: integer;
		hpGraph: Array<integer>;
		lamp: "EASY" | "FAIL" | "FULL COMBO" | "HARD" | "NO PLAY" | "NORMAL";
		maxCombo: integer;
		moneyScore: integer;
		notesPlayed: integer;
		notesTotal: integer;
		pgreat: integer;
		poor: integer;
	};
	unixTimestamp: integer | undefined; // Seconds since Unix epoch
}

export interface LR2HookContext {
	timeReceived: number;
}
