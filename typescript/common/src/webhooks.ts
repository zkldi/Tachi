import type {
	ClassAchievementSource,
	GoalImportStat,
	integer,
	QuestImportStat,
	V3Game,
} from "./types";
import type { Classes } from "./types/game-config";

/**
 * An event fired when a users class improves.
 */
export interface WebhookEventClassUpdateV1 {
	type: "class-update/v1";
	content: {
		/**
		 * How this class achievement was recorded. When `"manual"` (provided-class Import Class),
		 * clients should emphasize that this was user-entered, not inferred from scores/sync.
		 *
		 * Omit or `"import"` for normal score/importer-derived updates.
		 */
		achievementSource?: ClassAchievementSource;
		game: V3Game;
		new: string | null;
		old: string | null;
		set: Classes[V3Game];
		userID: integer;
	};
}

/**
 * An event fired when a goal is achieved.
 */
export interface WebhookEventGoalAchievedV1 {
	type: "goals-achieved/v1";
	content: {
		game: V3Game;
		goals: Array<{
			game: V3Game;
			goalID: string;
			new: GoalImportStat;
			old: GoalImportStat;
		}>;
		userID: integer;
	};
}

/**
 * An event fired when a quest is achieved.
 */
export interface WebhookEventQuestAchievedV1 {
	type: "quest-achieved/v1";
	content: {
		game: V3Game;
		new: QuestImportStat;
		old: QuestImportStat;
		questID: string;
		userID: integer;
	};
}

/**
 * An event used for debugging. Contains information about the
 * registered client and the server.
 */
export interface WebhookEventStatusV1 {
	type: "status/v1";
	content: {
		clientID: string;
		clientName: string;
		serverVersion: string;
	};
}

export type WebhookEvents =
	| WebhookEventClassUpdateV1
	| WebhookEventGoalAchievedV1
	| WebhookEventQuestAchievedV1;
