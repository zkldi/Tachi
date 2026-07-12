import { ACTION_CreateApiClient } from "#actions/create-api-client";
import { ACTION_DeleteApiClient } from "#actions/delete-api-client";
import { ACTION_ResetApiClientSecret } from "#actions/reset-api-client-secret";
import { ACTION_UpdateApiClient } from "#actions/update-api-client";
import { SELECT_API_CLIENT, ToAPIClientDocument } from "#lib/db-formats/api-client";
import { withClient } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";
import { type APIPermissions } from "tachi-common";

import { API_V1_ROUTER } from "../_singleton";

/**
 * Retrieve the clients you created. Must be performed with a session-level request.
 *
 * @warn This also returns the client_secrets! Those *have* to be kept secret.
 */
API_V1_ROUTER.add("GET /clients", async ({ req }) => {
	const user = req.session.tachi?.user;

	if (!user) {
		throw new ExpectedErr(
			401,
			"You are not authenticated (for a session-level request, at least).",
		);
	}

	const rows = await DB.selectFrom("priv_api_client")
		.select(SELECT_API_CLIENT)
		.where("priv_api_client.author", "=", user.id)
		.execute();

	const clients = rows.map(ToAPIClientDocument);

	return success(`Returned ${clients.length} clients.`, clients);
});

/**
 * Create a new API Client. Requires session-level auth.
 *
 * @param name - A string that identifies this client.
 * @param redirectUri - The redirectUri this client uses.
 * @param webhookUri - Optionally, a webhookUri to call with webhook events.
 * @param apiKeyTemplate - Optionally, a static format to apply when doing static auth.
 * @param apiKeyFilename - Optionally, a filename to automatically download the template to, when doing
 * static flow.
 * @param permissions - An array of APIPermissions this client is expected to use.
 */
API_V1_ROUTER.add("POST /clients/create", async ({ input, req }) => {
	const user = req.session.tachi?.user;

	if (!user) {
		throw new ExpectedErr(401, "You are not authenticated.");
	}

	const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

	const clientDoc = await ACTION_CreateApiClient(taker, {
		apiKeyFilename: input.apiKeyFilename ?? null,
		apiKeyTemplate: input.apiKeyTemplate ?? null,
		name: input.name,
		permissions: (input.permissions ?? []) as Array<APIPermissions>,
		redirectUri: input.redirectUri ?? null,
		webhookUri: input.webhookUri ?? null,
	});

	return success("Created a new API client.", clientDoc);
});

/**
 * Retrieves information about the client at this ID.
 */
API_V1_ROUTER.add("GET /clients/:clientID", withClient, ({ ctx }) =>
	success(`Retrieved client ${ctx.apiClientDoc.name}.`, ctx.apiClientDoc),
);

/**
 * Update an existing client. The requester must be the owner of this
 * client, and must also be making a session-level request.
 *
 * @param name - Change the name of this client.
 * @param webhookUri - Change a bound webhookUri for this client.
 * @param redirectUri - Change a bound redirectUri for this client.
 * @param apiKeyTemplate - Change the APIKeyTemplate for this client.
 * @param apiKeyFilename - Change the APIKeyFilename for this client.
 */
API_V1_ROUTER.add("PATCH /clients/:clientID", withClient, async ({ params, input, req }) => {
	const user = req.session.tachi?.user;

	if (!user) {
		throw new ExpectedErr(401, "You are not authenticated.");
	}

	const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

	const updatedClient = await ACTION_UpdateApiClient(taker, {
		apiKeyFilename: input.apiKeyFilename,
		apiKeyTemplate: input.apiKeyTemplate,
		clientID: params.clientID,
		name: input.name,
		redirectUri: input.redirectUri,
		webhookUri: input.webhookUri,
	});

	return success("Updated client.", updatedClient);
});

/**
 * Resets the clientSecret for this client.
 * This will NOT invalidate any existing tokens, as per oauth2 spec.
 */
API_V1_ROUTER.add("POST /clients/:clientID/reset-secret", withClient, async ({ params, req }) => {
	const user = req.session.tachi?.user;

	if (!user) {
		throw new ExpectedErr(401, "You are not authenticated.");
	}

	const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };
	const updatedClient = await ACTION_ResetApiClientSecret(taker, {
		clientID: params.clientID,
	});

	return success("Reset secret.", updatedClient);
});

/**
 * Delete this client. Must be authorized at a session-request level.
 */
API_V1_ROUTER.add("DELETE /clients/:clientID", withClient, async ({ params, req }) => {
	const user = req.session.tachi?.user;

	if (!user) {
		throw new ExpectedErr(401, "You are not authenticated.");
	}

	const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

	await ACTION_DeleteApiClient(taker, { clientID: params.clientID });

	return success(`Deleted client ${params.clientID}.`, {});
});
