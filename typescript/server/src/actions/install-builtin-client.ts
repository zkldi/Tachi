import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

export const ACTION_InstallBuiltinClient = MakeAction(
	"INSTALL_BUILTIN_CLIENT",
	async (
		taker,
		{ clientID, name, permissions, apiKeyFilename, apiKeyTemplate, redirectUri, webhookUri },
	) => {
		// verify taker is admin
		if (!(await IsUserAdmin(taker.acct.id))) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		// I honestly think this is unused for builtin clients
		// as they don't need to auth with anyone!
		const clientSecret = `CS${Random20Hex()}`;

		// create client
		await DB.insertInto("priv_api_client")
			.values({
				client_id: clientID,
				client_secret: clientSecret,
				name: name,
				author: taker.acct.id,
				pm_customise_profile: permissions.customise_profile,
				pm_customise_score: permissions.customise_score,
				pm_customise_session: permissions.customise_session,
				pm_delete_score: permissions.delete_score,
				pm_manage_rivals: permissions.manage_rivals,
				pm_manage_targets: permissions.manage_targets,
				pm_submit_score: permissions.submit_score,
				pm_manage_challenges: permissions.manage_challenges,
				api_key_filename: apiKeyFilename,
				api_key_template: apiKeyTemplate,
				webhook_uri: webhookUri,
				redirect_uri: redirectUri,
				is_builtin: true,
			})
			.onConflict((oc) =>
				oc.column("client_id").doUpdateSet({
					client_secret: clientSecret,
					name: name,
					author: taker.acct.id,
					pm_customise_profile: permissions.customise_profile,
					pm_customise_score: permissions.customise_score,
					pm_customise_session: permissions.customise_session,
					pm_delete_score: permissions.delete_score,
					pm_manage_rivals: permissions.manage_rivals,
					pm_manage_targets: permissions.manage_targets,
					pm_submit_score: permissions.submit_score,
					pm_manage_challenges: permissions.manage_challenges,
					api_key_filename: apiKeyFilename,
					api_key_template: apiKeyTemplate,
					webhook_uri: webhookUri,
					redirect_uri: redirectUri,
					is_builtin: true,
				}),
			)
			.execute();

		return {};
	},
);
