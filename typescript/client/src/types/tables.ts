import {
	type ChartDocument,
	type GameGroup,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type ImportDocument,
	type ImportTrackerFailed,
	type integer,
	type PBScoreDocument,
	type QuestDocument,
	type ScoreDocument,
	type SongDocument,
	type UserDocument,
	type UserGameStatsWithProfileLeaderboardRank,
	type V3Game,
} from "tachi-common";

export type PBDataset<TGame extends V3Game = V3Game> = ({
	__playcount?: integer;
	__related: {
		chart: ChartDocument<TGame>;
		index: integer;
		song: SongDocument<GameGroup>;
		user?: UserDocument;
	};
} & PBScoreDocument<TGame>)[];

export type ScoreDataset<TGame extends V3Game = V3Game> = ({
	__related: {
		chart: ChartDocument<TGame>;
		index: integer;
		song: SongDocument<GameGroup>;
		user: UserDocument;
	};
} & ScoreDocument<TGame>)[];

export type FolderDataset<TGame extends V3Game = V3Game> = ({
	__related: {
		pb: PBScoreDocument<TGame> | null;
		song: SongDocument<GameGroup>;
		user: UserDocument;
	};
} & ChartDocument<TGame>)[];

export type ChartLeaderboardDataset<TGame extends V3Game = V3Game> = ({
	__related: {
		user: UserDocument;
	};
} & PBScoreDocument<TGame>)[];

export type UGSDataset = ({
	__related: {
		index: integer;
		user: UserDocument;
	};
} & UserGameStatsWithProfileLeaderboardRank)[];

export type RivalChartDataset<TGame extends V3Game = V3Game> = ({
	__related: {
		index: number;
		pb: PBScoreDocument<TGame> | null;
	};
} & UserDocument)[];

export type ComparePBsDataset<TGame extends V3Game = V3Game> = Array<{
	base: PBScoreDocument<TGame> | null;
	chart: ChartDocument;
	compare: PBScoreDocument<TGame> | null;
	song: SongDocument;
}>;

export type ImportDataset = Array<
	{
		__related: {
			user: UserDocument;
		};
	} & ImportDocument
>;

export type FailedImportDataset = Array<
	{
		__related: {
			user: UserDocument;
		};
	} & ImportTrackerFailed
>;

export type GoalSubDataset = ({
	__related: {
		goal: GoalDocument;
		parentQuests: Array<QuestDocument>;
		user: UserDocument;
	};
} & GoalSubscriptionDocument)[];
