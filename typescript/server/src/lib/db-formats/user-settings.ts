import { type Selection } from "kysely";
import { type integer, type UserSettingsDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_USER_SETTINGS = [
	"account_settings.user_id",
	"account_settings.pf_invisible",
	"account_settings.pf_developer_mode",
	"account_settings.pf_advanced_mode",
	"account_settings.pf_contentious_content",
	"account_settings.pf_deletable_scores",
] as const;

export function ToUserSettingsDocument(
	following: Array<integer>,
	row: Selection<Database, "account_settings", (typeof SELECT_USER_SETTINGS)[number]>,
): UserSettingsDocument {
	return {
		userID: row.user_id,
		following,
		preferences: {
			invisible: row.pf_invisible,
			developerMode: row.pf_developer_mode,
			advancedMode: row.pf_advanced_mode,
			contentiousContent: row.pf_contentious_content,
			deletableScores: row.pf_deletable_scores,
		},
	};
}
