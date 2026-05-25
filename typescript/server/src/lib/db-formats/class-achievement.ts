import type { Database } from "tachi-db";

import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type Selection } from "kysely";
import { type ClassAchievementDocument, type V3Game } from "tachi-common";

export const SELECT_CLASS_ACHIEVEMENT_DOCUMENT = [
	"class_achievement.game",
	"class_achievement.user_id",
	"class_achievement.class_set",
	"class_achievement.class_prev_value",
	"class_achievement.class_value",
	"class_achievement.timestamp",
	"class_achievement.source",
] as const;

type ClassAchievementRow = Selection<
	Database,
	"class_achievement",
	(typeof SELECT_CLASS_ACHIEVEMENT_DOCUMENT)[number]
>;

export function ToClassAchievementDocument(row: ClassAchievementRow): ClassAchievementDocument {
	return {
		game: row.game as V3Game,
		classSet: row.class_set as ClassAchievementDocument["classSet"],
		classOldValue: row.class_prev_value === "" ? null : row.class_prev_value,
		classValue: row.class_value,
		timeAchieved: ISO8601ToUnixMilliseconds(row.timestamp),
		userID: row.user_id,
		source: row.source as ClassAchievementDocument["source"],
	};
}
