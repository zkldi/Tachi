import { type Selection } from "kysely";
import { type APIPermissions, type APITokenDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_API_TOKEN = [
	"priv_api_token.token",
	"priv_api_token.user_id",
	"priv_api_token.identifier",
	"priv_api_token.from_oauth2_client",
	"priv_api_token.pm_customise_profile",
	"priv_api_token.pm_customise_score",
	"priv_api_token.pm_customise_session",
	"priv_api_token.pm_delete_score",
	"priv_api_token.pm_manage_rivals",
	"priv_api_token.pm_manage_targets",
	"priv_api_token.pm_submit_score",
	"priv_api_token.pm_manage_challenges",
] as const;

export function ToAPITokenDocument(
	row: Selection<Database, "priv_api_token", (typeof SELECT_API_TOKEN)[number]>,
): APITokenDocument {
	const permissions: Partial<Record<APIPermissions, boolean>> = {};

	if (row.pm_customise_profile) {
		permissions.customise_profile = true;
	}
	if (row.pm_customise_score) {
		permissions.customise_score = true;
	}
	if (row.pm_customise_session) {
		permissions.customise_session = true;
	}
	if (row.pm_delete_score) {
		permissions.delete_score = true;
	}
	if (row.pm_manage_rivals) {
		permissions.manage_rivals = true;
	}
	if (row.pm_manage_targets) {
		permissions.manage_targets = true;
	}
	if (row.pm_submit_score) {
		permissions.submit_score = true;
	}
	if (row.pm_manage_challenges) {
		permissions.manage_challenges = true;
	}

	return {
		token: row.token,
		userID: row.user_id,
		identifier: row.identifier,
		permissions,
		fromAPIClient: row.from_oauth2_client,
	};
}
