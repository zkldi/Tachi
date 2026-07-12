import { MakeAction } from "#lib/actions/actions";
import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { DedupeArr, Random20Hex } from "#utils/misc";
import { IsUserAdmin } from "#utils/user";
import { validateWebhookUri } from "#utils/validate-webhook-uri";
import { ExpectedErr } from "bliss";
import { ALL_PERMISSIONS, type APIPermissions } from "tachi-common";

const VALID_PERMISSIONS = new Set(Object.keys(ALL_PERMISSIONS));

function permissionsToColumns(perms: Array<APIPermissions>) {
	return {
		pm_customise_profile: perms.includes("customise_profile") ? true : null,
		pm_customise_score: perms.includes("customise_score") ? true : null,
		pm_customise_session: perms.includes("customise_session") ? true : null,
		pm_delete_score: perms.includes("delete_score") ? true : null,
		pm_manage_rivals: perms.includes("manage_rivals") ? true : null,
		pm_manage_targets: perms.includes("manage_targets") ? true : null,
		pm_submit_score: perms.includes("submit_score") ? true : null,
		pm_manage_challenges: perms.includes("manage_challenges") ? true : null,
	};
}

export const ACTION_CreateApiClient = MakeAction(
	"CREATE_API_CLIENT",
	async (
		taker,
		{ name, redirectUri, webhookUri, apiKeyTemplate, apiKeyFilename, permissions },
	) => {
		const permissions_deduped = DedupeArr(permissions) as Array<APIPermissions>;

		const invalid = permissions_deduped.filter((p) => !VALID_PERMISSIONS.has(p));

		if (invalid.length > 0) {
			throw new ExpectedErr(400, `Invalid permissions: ${invalid.join(", ")}`);
		}

		if (permissions_deduped.length === 0) {
			throw new ExpectedErr(400, "Must require at least one permission.");
		}

		if (webhookUri !== null) {
			const rejection = validateWebhookUri(webhookUri);

			if (rejection) {
				throw new ExpectedErr(400, rejection);
			}
		}

		if (apiKeyTemplate !== null && !apiKeyTemplate.includes("%%TACHI_KEY%%")) {
			throw new ExpectedErr(400, "apiKeyTemplate must contain %%TACHI_KEY%%.");
		}

		const isAdmin = await IsUserAdmin(taker.acct.id);

		if (!isAdmin) {
			const existingCount = await DB.selectFrom("priv_api_client")
				.select(DB.fn.countAll().as("count"))
				.where("author", "=", taker.acct.id)
				.executeTakeFirstOrThrow();

			if (Number(existingCount.count) >= ServerConfig.OAUTH_CLIENT_CAP) {
				throw new ExpectedErr(
					400,
					`You have created too many API clients. The current cap is ${ServerConfig.OAUTH_CLIENT_CAP}.`,
				);
			}
		}

		const clientID = `CI${Random20Hex()}`;
		const clientSecret = `CS${Random20Hex()}`;

		await DB.insertInto("priv_api_client")
			.values({
				client_id: clientID,
				client_secret: clientSecret,
				name,
				author: taker.acct.id,
				redirect_uri: redirectUri,
				webhook_uri: webhookUri,
				api_key_template: apiKeyTemplate,
				api_key_filename: apiKeyFilename,
				is_builtin: false,
				...permissionsToColumns(permissions_deduped),
			})
			.execute();

		return {
			clientID,
			clientSecret,
			name,
			author: taker.acct.id,
			requestedPermissions: permissions_deduped,
			redirectUri,
			webhookUri,
			apiKeyTemplate,
			apiKeyFilename,
		};
	},
);
