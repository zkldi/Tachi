import { type Selection } from "kysely";
import { type APIPermissions, type TachiAPIClientDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_API_CLIENT = [
	"priv_api_client.client_id",
	"priv_api_client.client_secret",
	"priv_api_client.name",
	"priv_api_client.author",
	"priv_api_client.pm_customise_profile",
	"priv_api_client.pm_customise_score",
	"priv_api_client.pm_customise_session",
	"priv_api_client.pm_delete_score",
	"priv_api_client.pm_manage_rivals",
	"priv_api_client.pm_manage_targets",
	"priv_api_client.pm_submit_score",
	"priv_api_client.pm_manage_challenges",
	"priv_api_client.api_key_filename",
	"priv_api_client.api_key_template",
	"priv_api_client.webhook_uri",
	"priv_api_client.redirect_uri",
] as const;

export function ToAPIClientDocument(
	row: Selection<Database, "priv_api_client", (typeof SELECT_API_CLIENT)[number]>,
): TachiAPIClientDocument {
	const requestedPermissions: Array<APIPermissions> = [];
	if (row.pm_customise_profile) {
		requestedPermissions.push("customise_profile");
	}
	if (row.pm_customise_score) {
		requestedPermissions.push("customise_score");
	}
	if (row.pm_customise_session) {
		requestedPermissions.push("customise_session");
	}
	if (row.pm_delete_score) {
		requestedPermissions.push("delete_score");
	}
	if (row.pm_manage_rivals) {
		requestedPermissions.push("manage_rivals");
	}
	if (row.pm_manage_targets) {
		requestedPermissions.push("manage_targets");
	}
	if (row.pm_submit_score) {
		requestedPermissions.push("submit_score");
	}
	if (row.pm_manage_challenges) {
		requestedPermissions.push("manage_challenges");
	}

	return {
		clientID: row.client_id,
		clientSecret: row.client_secret,
		name: row.name,
		author: row.author,
		apiKeyFilename: row.api_key_filename,
		apiKeyTemplate: row.api_key_template,
		redirectUri: row.redirect_uri,
		requestedPermissions,
		webhookUri: row.webhook_uri,
	};
}
