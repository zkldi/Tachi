import {
	type ChartDocument,
	type ClassAchievementDocument,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type integer,
	type QuestDocument,
	type QuestSubscriptionDocument,
	type ScoreDocument,
	type SessionDocument,
	type SongDocument,
} from "tachi-common";

export type ClumpedActivityScores = {
	scores: Array<
		{
			__related: { chart: ChartDocument; song: SongDocument };
		} & ScoreDocument
	>;
	type: "SCORES";
};

export type ClumpedActivitySession = {
	type: "SESSION";
} & SessionDocument;

export type ClumpedActivityClassAchievement = {
	type: "CLASS_ACHIEVEMENT";
} & ClassAchievementDocument;

export type ClumpedActivityGoalAchievement = {
	goals: Array<{ __related: { goal: GoalDocument } } & GoalSubscriptionDocument>;
	type: "GOAL_ACHIEVEMENTS";
	// redundant, but convenient.
	userID: integer;
};

export type ClumpedActivityQuestAchievement = {
	quest: QuestDocument;
	sub: QuestSubscriptionDocument;
	type: "QUEST_ACHIEVEMENT";
	userID: integer;
};

export type ClumpedActivity = Array<
	| ClumpedActivityClassAchievement
	| ClumpedActivityGoalAchievement
	| ClumpedActivityQuestAchievement
	| ClumpedActivityScores
	| ClumpedActivitySession
>;

/**
 * A 'raw' quest document is one without goalID references -- that is -- they inline
 * what goals they have.
 *
 * This is convenient for editing and storing in localStorage so people can create their
 * own quests.
 */
export type RawQuestDocument = {
	rawQuestData: Array<RawQuestSection>;
} & Omit<QuestDocument, "questData" | "questID">;

export type RawQuestSection = {
	desc: string;
	rawGoals: Array<RawQuestGoal>;
	title: string;
};

export type RawQuestGoal = {
	goal: Pick<GoalDocument, "charts" | "criteria" | "name">;
	note?: string;
};

/**
 * A questline document without a server-assigned `questlineID`. Used when
 * authoring questlines locally in the Quest Editor before uploading as seeds.
 */
export type RawQuestlineDocument = {
	desc: string;
	/** V3Game identifier, e.g. `"iidx-sp"`. */
	game: string;
	name: string;
	/** User-chosen slug / identifier (becomes `questlineID` in seeds). */
	questlineID: string;
	/** Ordered list of `RawQuestDocument` references by their local index or slug. */
	quests: Array<string>;
};
