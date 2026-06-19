import { ACTION_CreateOAuth2AuthCode } from "#actions/create-oauth2-auth-code";
import { ANON_ACTION_OAuthTokenExchange } from "#anon-actions/oauth-token-exchange";
import { success } from "#lib/router/typed-router";
import { ExpectedErr } from "bliss";

import { API_V1_ROUTER } from "../_singleton";

/**
 * Converts an auth code into a valid API key that is returned.
 *
 * @note The params here are deliberately snake cased as that's what
 * the digitalocean examples for oauth2 do. I have no idea whether that's
 * part of the spec or not, but it probably is.
 *
 * @param client_id - The id for the client requesting a token.
 * @param client_secret - The secret for the client. Required if not doing pkce
 * @param grant_type - Only exactly "authorization_code" is supported at the moment.
 * @param redirect_uri - Must be the exact redirectUri registered with this client.
 * @param code - The code to convert into an API token.
 * @param code_verifier - PKCE verifier (RFC 7636). Required when the code was created with a code_challenge.
 *
 * @name POST /api/v1/oauth/token
 */
API_V1_ROUTER.add("POST /oauth/token", async ({ input, req }) => {
	const apiDoc = await ANON_ACTION_OAuthTokenExchange(
		{ ip: req.ip },
		{
			client_id: input.client_id,
			client_secret: input.client_secret,
			code: input.code,
			grant_type: input.grant_type,
			redirect_uri: input.redirect_uri,
			code_verifier: input.code_verifier,
		},
	);

	return success("Successfully authenticated.", apiDoc);
});

/**
 * Creates an authorization code for this user (inferred from session).
 *
 * @param code_challenge - PKCE code challenge (BASE64URL(SHA256(code_verifier))). Optional.
 * @param code_challenge_method - Must be "S256" if provided. Optional.
 *
 * @name POST /api/v1/oauth/create-code
 */
API_V1_ROUTER.add("POST /oauth/create-code", async ({ input, req }) => {
	if (!req.session.tachi?.user) {
		throw new ExpectedErr(401, "You are not authenticated.");
	}

	const user = req.session.tachi.user;
	const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

	const doc = await ACTION_CreateOAuth2AuthCode(taker, {
		codeChallenge: input.code_challenge,
		codeChallengeMethod: input.code_challenge_method,
	});

	return success("Successfully created code.", doc);
});
