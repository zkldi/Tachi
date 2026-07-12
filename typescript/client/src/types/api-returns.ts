import {
	type APIPermissions,
	type ChallengeSubscriptionDocument,
	type ChartDocument,
	type ClassAchievementDocument,
	type FolderDocument,
	type GameConfig,
	type GameGroup,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type ImportDocument,
	type ImportTrackerFailed,
	type integer,
	type PBScoreDocument,
	type ProfileRatingAlgorithms,
	type QuestDocument,
	type QuestlineDocument,
	type QuestSubscriptionDocument,
	type ScoreDocument,
	type SessionDocument,
	type SessionScoreInfo,
	type ShowcaseStatChart,
	type ShowcaseStatFolder,
	type SongDocument,
	type TableDocument,
	type UserDocument,
	type UserGameStats,
	type UserGameStatsSnapshotDocument,
	type UserGameStatsWithProfileLeaderboardRank,
	type V3Game,
} from "tachi-common";

export interface UserGameStatsReturn<TGame extends V3Game = V3Game> {
	gameStats: UserGameStats;
	firstScore: ScoreDocument<TGame>;
	mostRecentScore: ScoreDocument<TGame>;
	totalScores: number;
	rankingData: Record<
		ProfileRatingAlgorithms[TGame],
		{
			outOf: integer;
			ranking: integer;
		}
	>;
	playtime: number;
}

export interface UserGameLeaderboardAdjacent {
	above: UserGameStatsWithProfileLeaderboardRank[];
	below: UserGameStatsWithProfileLeaderboardRank[];
	users: UserDocument[];
	thisUsersStats: UserGameStatsWithProfileLeaderboardRank;
	thisUsersRanking: {
		outOf: integer;
		ranking: integer;
	};
}

export interface GameLeaderboard {
	gameStats: UserGameStatsWithProfileLeaderboardRank[];
	users: UserDocument[];
}

export type UserGamePreferenceStatsReturn =
	| {
			related: {
				chart: ChartDocument;
				song: SongDocument;
			};
			result: { pb: PBScoreDocument | null; playcount: number };
			stat: ShowcaseStatChart;
	  }
	| {
			related: { folder: FolderDocument };
			result: { outOf: integer; value: integer };
			stat: ShowcaseStatFolder;
	  };

export type UserGamePreferenceChartStatsReturn = Extract<
	UserGamePreferenceStatsReturn,
	{ stat: ShowcaseStatChart }
>;

export type UserGamePreferenceFolderStatsReturn = Extract<
	UserGamePreferenceStatsReturn,
	{ stat: ShowcaseStatFolder }
>;

export type UserGameHistory = Omit<UserGameStatsSnapshotDocument, "game" | "playtype" | "userID">[];

export interface SessionReturns<TGame extends V3Game = V3Game> {
	session: SessionDocument;
	scores: ScoreDocument[];
	scoreInfo: Array<SessionScoreInfo>;
	songs: SongDocument<GameGroup>[];
	charts: ChartDocument<TGame>[];
	user: UserDocument;
	index: number;
}

export interface SessionAdjacentReturns {
	prev: SessionDocument | null;
	next: SessionDocument | null;
}

export interface UserGameChartPBComposition<TGame extends V3Game = V3Game> {
	scores: ScoreDocument<TGame>[];
	chart: ChartDocument<TGame>;
	pb: PBScoreDocument<TGame>;
}

export type UGSWithRankingData<TGame extends V3Game = V3Game> = {
	__rankingData: Record<ProfileRatingAlgorithms[TGame], { outOf: number; ranking: number }>;
} & UserGameStats;

export interface SongChartsSearch<TGame extends V3Game = V3Game> {
	songs: SongDocument<GameGroup>[];
	charts: ChartDocument<TGame>[];
}

export interface FolderStatsInfo {
	stats: Record<string, Record<string, integer>>;
	slug: string;
	chartCount: integer;
}

export interface UserGameFolderSearch {
	folders: FolderDocument[];
	stats: FolderStatsInfo[];
}

export interface UserGameTableReturns {
	folders: FolderDocument[];
	stats: FolderStatsInfo[];
	table: TableDocument;
}

/** Rows returned by `GET .../tables/:tableID/evolution`. */
export interface TableEvolutionEventAPI {
	chartID: string;
	enumIndex: integer;
	metric: string;
	scoreID: string;
	timeAchieved: number | null;
	timeAdded: number;
	value: string;
}

export interface UserGameTableEvolutionReturns {
	charts: ChartDocument[];
	events: TableEvolutionEventAPI[];
	folderChartIDs: Record<string, string[]>;
	folders: FolderDocument[];
	songs: SongDocument<GameGroup>[];
	table: TableDocument;
}

/** Same event/chart payloads as table evolution; scoped to a single folder. */
export interface UserGameFolderEvolutionReturns {
	charts: ChartDocument[];
	events: TableEvolutionEventAPI[];
	folder: FolderDocument;
	folderChartIDs: Record<string, string[]>;
	folders: FolderDocument[];
	songs: SongDocument<GameGroup>[];
}

export type UserGameEvolutionReplayReturns =
	| UserGameFolderEvolutionReturns
	| UserGameTableEvolutionReturns;

export interface UserGameFolderReturns<TGame extends V3Game = V3Game> {
	folder: FolderDocument;
	songs: SongDocument<GameGroup>[];
	charts: ChartDocument<TGame>[];
	pbs: PBScoreDocument<TGame>[];
}

/** `GET .../folders/:folderSlug/stats`. */
export interface UserGameFolderSlugStatsReturns {
	folder: FolderDocument;
	stats: FolderStatsInfo | null;
}

export interface GameFolderReturns<TGame extends V3Game = V3Game> {
	folder: FolderDocument;
	songs: SongDocument<GameGroup>[];
	charts: ChartDocument<TGame>[];
}

export interface GameStatsReturn {
	config: GameConfig;
	playerCount: integer;
	chartCount: integer;
	scoreCount: integer;
}

export interface RecentClassesReturn {
	classes: ClassAchievementDocument[];
	users: UserDocument[];
}

export interface SongsReturn<TGame extends V3Game = V3Game> {
	song: SongDocument<GameGroup>;
	charts: ChartDocument<TGame>[];
}

export interface ChartPBLeaderboardReturn<TGame extends V3Game = V3Game> {
	users: UserDocument[];
	pbs: PBScoreDocument<TGame>[];
}

export interface UserGameChartLeaderboardAdjacent<TGame extends V3Game = V3Game> {
	users: UserDocument[];
	pb: PBScoreDocument<TGame>;
	adjacentAbove: PBScoreDocument<TGame>[];
	adjacentBelow: PBScoreDocument<TGame>[];
}

export interface ScoreLeaderboardReturns<TGame extends V3Game = V3Game> {
	users: UserDocument[];
	songs: SongDocument<GameGroup>[];
	charts: ChartDocument<TGame>[];
	pbs: PBScoreDocument<TGame>[];
}

export interface UserLeaderboardReturns {
	users: UserDocument[];
	gameStats: UserGameStatsWithProfileLeaderboardRank[];
}

export interface UserRecentSummary {
	recentPlaycount: integer;
	recentSessions: SessionDocument[];
	recentFolders: FolderDocument[];
	recentFolderStats: FolderStatsInfo[];
	recentGoals: GoalDocument[];
	recentImprovedGoals: GoalSubscriptionDocument[];
	recentAchievedGoals: GoalSubscriptionDocument[];
}

export interface ServerStatus {
	serverTime: number;
	startTime: number;
	version: string;
	whoami: integer | null;
	permissions: APIPermissions[];
}

export interface ChallengeSubsReturn {
	rivals: Array<UserDocument>;
	pbs: Array<PBScoreDocument>;
	challengeSubs: Array<ChallengeSubscriptionDocument>;
	songs: Array<SongDocument>;
	charts: Array<ChartDocument>;
}

export interface ChartRivalsReturn {
	rivals: Array<UserDocument>;
	pbs: Array<PBScoreDocument>;
}

export interface ImportIDReturn {
	scores: ScoreDocument[];
	songs: SongDocument[];
	charts: ChartDocument[];
	sessions: SessionDocument[];
	import: ImportDocument;
	user: UserDocument;
}

export interface FailedImportsReturn {
	failedImports: Array<ImportTrackerFailed>;
	users: Array<UserDocument>;
}

export interface ImportsReturn {
	imports: Array<ImportDocument>;
	users: Array<UserDocument>;
}

export interface ActivityReturn {
	recentSessions: Array<SessionDocument>;

	songs: Array<SongDocument>;
	charts: Array<ChartDocument>;
	recentlyHighlightedScores: Array<ScoreDocument>;
	achievedClasses: Array<ClassAchievementDocument>;

	goals: Array<GoalDocument>;
	quests: Array<QuestDocument>;

	// recently achieved goal/quest subs
	goalSubs: Array<GoalSubscriptionDocument>;
	questSubs: Array<QuestSubscriptionDocument>;

	users: Array<UserDocument>;
}

export type RecordActivityReturn = Partial<Record<V3Game, ActivityReturn>>;

export interface GoalsOnChartReturn {
	goals: Array<GoalDocument>;
	goalSubs: Array<GoalSubscriptionDocument>;
	quests: Array<QuestDocument>;
	questSubs: Array<QuestSubscriptionDocument>;
}

export type GoalsOnFolderReturn = GoalsOnChartReturn;
export type AllUserGameGoalsReturn = GoalsOnChartReturn;

export interface RecentlyAchievedOrRaisedTargets {
	goals: Array<GoalDocument>;
	quests: Array<QuestDocument>;
	goalSubs: Array<GoalSubscriptionDocument>;
	questSubs: Array<QuestSubscriptionDocument>;
	user: UserDocument;
}

export interface GameQuestsReturn {
	goals: Array<GoalDocument>;
	quests: Array<QuestDocument>;
}

export interface UserGameTargetSubs {
	goalSubs: Array<GoalSubscriptionDocument>;
	questSubs: Array<QuestSubscriptionDocument>;
}

export interface QuestlineReturn {
	questline: QuestlineDocument;
	quests: Array<QuestDocument>;
	goals: Array<GoalDocument>;
}

export interface QuestReturn {
	quest: QuestDocument;
	questSubs: Array<QuestSubscriptionDocument>;
	users: Array<UserDocument>;
	goals: Array<GoalDocument>;
	parentQuestlines: Array<QuestlineDocument>;
}

export type SessionFolderRaises = {
	folder: FolderDocument;
	previousCount: integer; // how many AAAs/HARD CLEARs/whatevers was on this
	raisedCharts: Array<string>; // Array<chartID>;
	// folder before this session?
	totalCharts: integer;
	type: string;
	value: string;
};
