import type {
	APIPermissions,
	ChartDocument,
	ImportDocument,
	integer,
	ProfileRatingAlgorithms,
	ScoreDocument,
	SongDocument,
	UserGameStats,
	V3Game,
} from "tachi-common";

export interface ServerStatus {
	serverTime: number;
	startTime: number;
	version: string;
	whoami: integer | null;
	permissions: Array<APIPermissions>;
}

export interface ImportDeferred {
	url: string;
	importID: string;
}

export type ImportPollStatus =
	| {
			import: ImportDocument;
			importStatus: "completed";
	  }
	| {
			importStatus: "ongoing";
			progress: {
				description: string;
				value: integer;
			};
	  };

export interface UserGameStatsReturn<TGame extends V3Game = V3Game> {
	gameStats: UserGameStats;
	firstScore: ScoreDocument;
	mostRecentScore: ScoreDocument;
	totalScores: integer;
	rankingData: Record<ProfileRatingAlgorithms[TGame], { outOf: integer; ranking: integer }>;
}

export interface ChartQueryReturns {
	charts: Array<{ __playcount: integer } & ChartDocument>;
	songs: Array<SongDocument>;
}
