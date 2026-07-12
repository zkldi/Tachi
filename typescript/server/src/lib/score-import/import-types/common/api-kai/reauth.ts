import type { KtLogger } from "#lib/log/log";
import type { KaiAuthDocument } from "tachi-common";

import { updateKaiAuthTokensInDb } from "#lib/kai-auth-token/persist";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import nodeFetch from "#utils/fetch";
import { p } from "prudence";

import { GetKaiTypeClientCredentials, KaiTypeToBaseURL } from "./utils";

const REAUTH_SCHEMA = {
	access_token: "string",
	refresh_token: "string",
};

export function CreateKaiReauthFunction(
	kaiType: "EAG" | "FLO" | "MIN",
	authDoc: KaiAuthDocument,
	log: KtLogger,
	fetch = nodeFetch,
) {
	const maybeCredentials = GetKaiTypeClientCredentials(kaiType);

	/* istanbul ignore next */
	if (!maybeCredentials) {
		log.error(
			`No CLIENT_ID or CLIENT_SECRET was configured for ${kaiType}. Cannot create reauth function.`,
		);
		throw new ScoreImportFatalError(
			500,
			`Fatal error in performing authentication. This has been reported.`,
		);
	}

	const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = maybeCredentials;

	return async () => {
		const url = `${KaiTypeToBaseURL(kaiType)}/oauth/token`;
		let res;

		try {
			const body = new URLSearchParams({
				refresh_token: authDoc.refreshToken,
				grant_type: "refresh_token",
				client_secret: CLIENT_SECRET,
				client_id: CLIENT_ID,
			});
			// Some OAuth servers (e.g. Passport-style) require redirect_uri on refresh
			// to match the original authorization request.
			body.append("redirect_uri", REDIRECT_URI);

			res = await fetch(url, {
				body: body.toString(),
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			});
		} catch (err) {
			log.error({ res, err }, `Unexpected error while fetching reauth?`);
			throw new ScoreImportFatalError(
				500,
				"An error has occurred while attempting reauthentication.",
			);
		}

		/* istanbul ignore next */
		if (res.status !== 200) {
			const text = await res.text();

			if (res.status === 400) {
				log.error(
					{ text, url },
					`OAuth refresh returned 400 (often invalid refresh_token or redirect_uri mismatch).`,
				);
				// we now entirely expect this and have no way to fix it.
				throw new ScoreImportFatalError(
					400,
					`Your authentication with this service has expired, and a bug on their end prevents us from automatically renewing it.
					
					Please go to ${ServerConfig.OUR_URL}/u/me/integrations/services to un-link and re-link.`,
				);
			}

			log.error({ res, text }, `Unexpected ${res.status} error while fetching reauth?`);
			throw new ScoreImportFatalError(
				500,
				"An error has occurred while attempting reauthentication.",
			);
		}

		let json;
		/* istanbul ignore next */

		try {
			json = (await res.json()) as unknown;
		} catch (err) {
			log.error({ res, err }, `Invalid JSON body in successful reauth response.`);
			throw new ScoreImportFatalError(
				500,
				"An error has occurred while attempting reauthentication.",
			);
		}

		const err = p(json, REAUTH_SCHEMA, {}, { allowExcessKeys: true, throwOnNonObject: false });

		if (err) {
			log.error({ err, json }, `Invalid JSON body in successful reauth response.`);
			throw new ScoreImportFatalError(
				500,
				"An error has occurred while attempting reauthentication.",
			);
		}

		// asserted by prudence
		const validatedContent = json as {
			access_token: string;
			refresh_token: string;
		};

		await updateKaiAuthTokensInDb(
			DB,
			authDoc.userID,
			authDoc.service,
			validatedContent.access_token,
			validatedContent.refresh_token,
		);

		return validatedContent.access_token;
	};
}
