import { AuthLevelToInt } from "#utils/conversion";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type Selection } from "kysely";
import { type UserBadges, type UserDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_USER = [
	"account.id",
	"account.bd_alpha",
	"account.bd_beta",
	"account.bd_dev_team",
	"account.about",
	"account.auth_level",
	"account.custom_banner_location",
	"account.custom_pfp_location",
	"account.joined",
	"account.last_seen",
	"account.sm_discord",
	"account.sm_twitter",
	"account.sm_github",
	"account.sm_steam",
	"account.sm_youtube",
	"account.sm_twitch",
	"account.status",
	"account.username",
	"account.normalized_username",
	"account.is_supporter",
	"account.can_submit_quests",
	"account.can_import_provided_class",
] as const;

export function ToUserDocument(
	row: Selection<Database, "account", (typeof SELECT_USER)[number]>,
): UserDocument {
	const badges: Array<UserBadges> = [];

	if (row.bd_alpha) {
		badges.push("alpha");
	}
	if (row.bd_beta) {
		badges.push("beta");
	}
	if (row.bd_dev_team) {
		badges.push("dev-team");
	}

	return {
		about: row.about,
		authLevel: AuthLevelToInt(row.auth_level),
		badges,
		customBannerLocation: row.custom_banner_location,
		customPfpLocation: row.custom_pfp_location,
		id: row.id,
		joinDate: ISO8601ToUnixMilliseconds(row.joined),
		lastSeen: ISO8601ToUnixMilliseconds(row.last_seen),
		socialMedia: {
			discord: row.sm_discord,
			twitter: row.sm_twitter,
			github: row.sm_github,
			steam: row.sm_steam,
			youtube: row.sm_youtube,
			twitch: row.sm_twitch,
		},
		status: row.status,
		username: row.username,
		usernameLowercase: row.normalized_username,
		isSupporter: row.is_supporter,
		canSubmitQuests: row.can_submit_quests,
		canImportProvidedClass: row.can_import_provided_class,
	};
}
