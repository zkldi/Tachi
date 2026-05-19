import { ACTION_RevokeKaiAuthToken } from "#actions/revoke-kai-auth-token";
import { ACTION_UpsertKaiAuthToken } from "#actions/upsert-kai-auth-token";
import { log } from "#lib/log/log";
import { withKamaitachi, withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import {
	GetKaiTypeClientCredentials,
	KaiTypeToBaseURL,
} from "#lib/score-import/import-types/common/api-kai/utils";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import fetch from "#utils/fetch";
import { GetKaiAuth } from "#utils/queries/auth";
import { FormatUserDoc } from "#utils/user";
import { ExpectedErr } from "bliss";
import { p } from "prudence";

const KAI_OAUTH2_RETURN_SCHEMA = {
	access_token: "string",
	refresh_token: "string",
};

/** Validate and normalise `:kaiType` param, returning the uppercase service identifier. */
function resolveKaiType(kaiType: string | undefined): "EAG" | "FLO" | "MIN" {
	if (kaiType === undefined || !["eag", "flo", "min"].includes(kaiType.toLowerCase())) {
		throw new ExpectedErr(400, "Invalid kaiType - Expected min, flo or eag.");
	}

	return kaiType.toUpperCase() as "EAG" | "FLO" | "MIN";
}

/**
 * Return the authentication status for this kaiType.
 *
 * @name GET /api/v1/users/:userID/integrations/kai/:kaiType
 */
API_V1_ROUTER.add(
	"GET /users/:userID/integrations/kai/:kaiType",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ params, ctx }) => {
		const kaiType = resolveKaiType(params.kaiType);
		const { requestedUser: user } = ctx;

		const authDoc = await GetKaiAuth(user.id, kaiType);

		return success(authDoc ? "User is authenticated." : "User is unauthenticated.", {
			authStatus: !!authDoc,
		});
	},
);

/**
 * Revoke your authentication for this kaiType.
 *
 * @name DELETE /api/v1/users/:userID/integrations/kai/:kaiType
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/integrations/kai/:kaiType",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ params, ctx, req }) => {
		const kaiType = resolveKaiType(params.kaiType);
		const { requestedUser: user } = ctx;

		const authDoc = await GetKaiAuth(user.id, kaiType);

		if (!authDoc) {
			throw new ExpectedErr(409, "You are not authorised with this service.");
		}

		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		await ACTION_RevokeKaiAuthToken(taker, { service: kaiType });

		return success(`Revoked authentication for ${kaiType}.`, {});
	},
);

/**
 * The OAuth2 callback used by Kai to send an intermediate token to.
 * @note The way this is implemented is *really* weird due to the fact that
 * the tachi-server code cannot have any knowledge of the tachi-client code,
 * and the two must be agnostic.
 *
 * This means the tachi-client will handle the redirecting, and will check
 * query params for ?code=12345 to know when to POST us with the code
 * to perform an update.
 *
 * @param code - An intermediate code to use to get the real auth token.
 *
 * @name POST /api/v1/users/:userID/integrations/kai/:kaiType/oauth2callback
 */
API_V1_ROUTER.add(
	"POST /users/:userID/integrations/kai/:kaiType/oauth2callback",
	withKamaitachi,
	withSelf,
	withRequestedUser,
	async ({ input, params, ctx, req }) => {
		const kaiType = resolveKaiType(params.kaiType);
		const { requestedUser: user } = ctx;

		const baseUrl = KaiTypeToBaseURL(kaiType);

		const maybeCredentials = GetKaiTypeClientCredentials(kaiType);

		if (!maybeCredentials) {
			log.error(
				`Attempted to /callback ${kaiType}, but this server has no oauth2 credentials configured for that type.`,
			);
			throw new ExpectedErr(500, "A fatal error has occured, This has been reported.");
		}

		const { CLIENT_SECRET, CLIENT_ID, REDIRECT_URI } = maybeCredentials;

		const url = `${baseUrl}/oauth/token`;

		const params_ = new URLSearchParams();

		params_.append("code", input.code);
		params_.append("grant_type", "authorization_code");
		params_.append("client_secret", CLIENT_SECRET);
		params_.append("client_id", CLIENT_ID);
		params_.append("redirect_uri", REDIRECT_URI);

		log.info(`Making token reify request from ${baseUrl}/oauth/token`);
		let getTokenRes;

		try {
			getTokenRes = await fetch(url, {
				body: params_.toString(),
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				method: "POST",
			});
		} catch (err) {
			log.error(err, `Completely failed to getTokenRes from ${url}.`);
			throw new ExpectedErr(500, "We failed to reach this site. Are they down?");
		}

		if (getTokenRes.status !== 200) {
			log.error(`Unexpected status of ${getTokenRes.status} from ${url} oauth2 flow.`);
			throw new ExpectedErr(
				getTokenRes.status < 500 ? 400 : 500,
				`The server you requested returned a status of ${getTokenRes.status}. Either your request was malformed, or the server is malfunctioning.`,
			);
		}

		let json: unknown;

		try {
			json = await getTokenRes.json();
		} catch (err) {
			log.error(
				{ res: getTokenRes, err },
				`Error parsing JSON in response body from getTokenRes.`,
			);
			throw new ExpectedErr(
				500,
				"Failed to parse JSON returned from this service. Is their server malfunctioning?",
			);
		}

		const err = p(json, KAI_OAUTH2_RETURN_SCHEMA, {}, { allowExcessKeys: true });

		if (err) {
			log.error({ err }, `Validation error in JSON return from ${url}.`);
			throw new ExpectedErr(
				500,
				"Failed to validate JSON returned from this service. Is their server malfunctioning?",
			);
		}

		const j = json as { access_token: string; refresh_token: string };

		const taker = { ip: req.ip, acct: { id: user.id, username: user.username } };

		await ACTION_UpsertKaiAuthToken(taker, {
			service: kaiType,
			token: j.access_token,
			refreshToken: j.refresh_token,
		});

		log.info(`Updated Auth for ${kaiType} for user ${FormatUserDoc(user)}.`);

		return success(`Successfully updated auth for ${kaiType}`, {});
	},
);
