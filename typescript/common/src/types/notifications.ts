import type { integer, V3Game } from "../types";

export interface BaseNotification {
	title: string;
	notifID: string;

	// The user this notification was sent to.
	sentTo: integer;
	sentAt: integer;
	read: boolean;
}

export type NotificationBody =
	| {
			content: {
				game: V3Game;
				questID: string;
			};
			type: "QUEST_CHANGED"; // Emitted when a quest the user is subscribed to changed.
	  }
	| {
			content: {
				game: V3Game;
				userID: integer;
			};
			type: "RIVALED_BY"; // Emitted when the user is rivalled by someone.
	  }
	| {
			content: {
				scoreCount: integer;
			};
			type: "ORPHANS_RESTORED"; // Emitted after orphaned scores were successfully imported.
	  }
	| {
			content: Record<string, never>;
			type: "SITE_ANNOUNCEMENT"; // Emitted as a site announcement
	  };
