import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { GetClientByID } from "#utils/queries/api-clients";
import { validateWebhookUri } from "#utils/validate-webhook-uri";
import { ExpectedErr } from "bliss";

export const ACTION_UpdateApiClient = MakeAction(
	"UPDATE_API_CLIENT",
	async (taker, { clientID, name, redirectUri, webhookUri, apiKeyTemplate, apiKeyFilename }) => {
		const existing = await DB.selectFrom("priv_api_client")
			.select(["client_id", "author"])
			.where("client_id", "=", clientID)
			.executeTakeFirst();

		if (!existing) {
			throw new ExpectedErr(404, "This client does not exist.");
		}

		if (existing.author !== taker.acct.id) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		const updates: {
			api_key_filename?: string | null;
			api_key_template?: string | null;
			name?: string;
			redirect_uri?: string | null;
			webhook_uri?: string | null;
		} = {};

		if (name !== undefined) {
			updates.name = name;
		}

		if (redirectUri !== undefined) {
			updates.redirect_uri = redirectUri;
		}

		if (webhookUri !== undefined) {
			if (webhookUri !== null) {
				const rejection = validateWebhookUri(webhookUri);

				if (rejection) {
					throw new ExpectedErr(400, rejection);
				}
			}

			updates.webhook_uri = webhookUri;
		}

		if (apiKeyTemplate !== undefined) {
			if (apiKeyTemplate !== null && !apiKeyTemplate.includes("%%TACHI_KEY%%")) {
				throw new ExpectedErr(400, "apiKeyTemplate must contain %%TACHI_KEY%%.");
			}

			updates.api_key_template = apiKeyTemplate;
		}

		if (apiKeyFilename !== undefined) {
			updates.api_key_filename = apiKeyFilename;
		}

		if (Object.keys(updates).length === 0) {
			throw new ExpectedErr(400, "No changes to make.");
		}

		await DB.updateTable("priv_api_client")
			.set(updates)
			.where("client_id", "=", clientID)
			.execute();

		const updated = await GetClientByID(clientID);

		if (!updated) {
			throw new ExpectedErr(500, "Failed to retrieve updated client.");
		}

		return updated;
	},
);
