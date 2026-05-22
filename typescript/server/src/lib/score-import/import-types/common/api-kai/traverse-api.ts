import type { KtLogger } from "#lib/log/log";

import { VERSION_STR } from "#lib/constants/version";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { TachiConfig } from "#lib/setup/config";
import nodeFetch from "#utils/fetch";
import { IsRecord } from "#utils/misc";
import { URL } from "url";

/**
 * A Kai Reauth function is an async function that returns a string
 * which represents the new token to use, OR throws a score import
 * fatal error if reauthentication fails.
 */
export type KaiAPIReauthFunction = () => Promise<string>;

/**
 * there is the (strange) case here where we could end up
 * infinitely requesting re-auth and, despite succeeding,
 * continually failing on new requests.
 * in this case, we check if we've exceeded the maximum amount of
 * reauths, and will throw if it is exceeded.
 */
const MAX_REAUTH_ATTEMPTS = 1;

/**
 * Defines the absolute maximum amount of loops this function can do.
 * A maliciously crafted API can cause us to enter an infinite loop and
 * blow up - we don't want that.
 */
const MAX_ITERATIONS = 500;

/**
 * Traverses a Kai-like personal_bests api.
 * @param baseUrl The base URL to fetch requests from. - like https://google.com
 * @param subUrl The endpoint for the scores - /api/v1/personal_bests
 * @param authDoc The user's authentication document.
 * @param fetch This is so `fetch` can be mocked with something
 * that wont make http requests during tests.
 */
export async function* TraverseKaiAPI(
	baseUrl: string,
	subUrl: string,
	token: string,
	log: KtLogger,
	reauthFunction: KaiAPIReauthFunction | null = null,
	fetch = nodeFetch,
) {
	let fetchMoreData = true;
	let url = `${baseUrl}${subUrl}`;

	let reauthAttempts = 0;
	let currentIteration = 0;

	while (fetchMoreData) {
		// Rough SSRF check - KAI-like apis could potentially get us to perform
		// SSRF. We check if the origin of the next request is exactly the
		// original, expected, base URL.
		const origin = new URL(url).origin;

		if (origin !== baseUrl) {
			log.error(`${baseUrl} attempted SSRF with url ${url}?`);

			throw new ScoreImportFatalError(500, `${baseUrl} returned invalid data.`);
		}

		let json;
		let res;

		// wrap all this in a try catch just incase the fetch or the res
		// json call fails.

		try {
			// eslint-disable-next-line no-await-in-loop
			res = await fetch(url, {
				headers: {
					Authorization: `Bearer ${token}`,
					"User-Agent": `${TachiConfig.NAME}/${VERSION_STR}`,
					"Content-Type": "application/json",
				},
			});
		} catch (err) {
			log.error({ err }, `Received invalid response from ${url}.`);
			throw new ScoreImportFatalError(
				500,
				`Received invalid response from their API. Are they down?`,
			);
		}

		// if we are unauthorised or forbidden we need to attempt
		// reauth
		if (res.status === 401 || res.status === 403) {
			reauthAttempts++;
			if (reauthAttempts > MAX_REAUTH_ATTEMPTS) {
				throw new ScoreImportFatalError(
					500,
					`Attempted to reauthenticate with ${baseUrl} more than ${MAX_REAUTH_ATTEMPTS} times. The problem is likely not on our end.`,
				);
			}

			if (!reauthFunction) {
				throw new ScoreImportFatalError(
					res.status,
					`Unable to authenticate with ${baseUrl} and reauthentication was not possible.`,
				);
			}

			// reassigning this param is fine.
			// eslint-disable-next-line no-await-in-loop
			token = await reauthFunction();

			// then go to the start of the while loop.
			continue;
		}

		let text;

		try {
			// Split this into text -> JSON parse so we can read the text for better error messages
			// in the case of disaster.
			// eslint-disable-next-line no-await-in-loop
			text = await res.text();

			json = JSON.parse(text) as unknown;
		} catch (err) {
			log.error(
				{ err, text },
				`Received invalid (non-json) response from ${url}. Status code was ${res.status}.`,
			);
			throw new ScoreImportFatalError(
				500,
				`Received invalid response from their API. Are they down?`,
			);
		}

		if (!IsRecord(json)) {
			log.error({ json }, `Received invalid (non-object, but json) response from ${url}.`);
			throw new ScoreImportFatalError(
				500,
				`Received invalid response from their API. Are they down?`,
			);
		}

		if (!IsRecord(json._links)) {
			log.error({ body: json }, `Received invalid JSON from ${url}. Invalid _links.`);

			throw new ScoreImportFatalError(
				500,
				`Received no _links prop from their API. This is not an error with ${TachiConfig.NAME}.`,
			);
		}

		currentIteration++;

		if (currentIteration > MAX_ITERATIONS) {
			log.error(
				`An infinite loop has occurred - Terminating at MAX_ITERATIONS (${MAX_ITERATIONS}).`,
			);
			throw new ScoreImportFatalError(
				508,
				"An infinite loop appears to have occurred while synchronising with this api.",
			);
		}

		if (typeof json._links._next === "string") {
			url = json._links._next;
		} else if (json._links._next === null) {
			// exit the loop after this, we're on the last page.
			fetchMoreData = false;
		} else {
			log.error(
				{
					body: json,
				},
				`Received invalid response from ${url}. Invalid _links._next.`,
			);

			throw new ScoreImportFatalError(
				500,
				`Received invalid _links._next prop from their API.`,
			);
		}

		if (!Array.isArray(json._items)) {
			log.error(
				{
					body: json,
				},
				`Received invalid response from ${url}. Invalid _items.`,
			);

			throw new ScoreImportFatalError(500, `Received invalid _items from their API.`);
		}

		// yield everything out of the score array
		for (const score of json._items) {
			yield score as unknown;
		}
	}
}
