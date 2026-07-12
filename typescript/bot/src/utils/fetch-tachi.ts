import type { integer, SuccessfulAPIResponse, UnsuccessfulAPIResponse } from "tachi-common";

import { log } from "#utils/log";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

import { Env } from "../config";
import { VERSION_STR } from "../version";

type ApiResponseBase = {
	statusCode: integer;
};

export type APIResponse<T> = (
	| ({ body: null } & UnsuccessfulAPIResponse)
	| SuccessfulAPIResponse<T>
) &
	ApiResponseBase;

export enum RequestTypes {
	DELETE = "DELETE",
	GET = "GET",
	PATCH = "PATCH",
	POST = "POST",
	PUT = "PUT",

	// HEAD, OPTIONS not used by tachi-server anywhere.
}

const USER_AGENT = `Tachi-bot v${VERSION_STR}`;

/**
 * Performs a request against the Tachi server.
 *
 * @param method - What HTTP method to use. This does not support GET requests - for that, @see TachiServerGet
 * @param url - The URL to perform this against.
 * @param body - Optionally, provide some content for the request body.
 * @param T - A generic that asserts the type of the response contents. Defaults to unknown.
 */
export async function TachiServerV1Request<T>(
	method: Exclude<RequestTypes, RequestTypes.GET>,
	url: string,
	token?: string | null,
	body: unknown = {},
): Promise<APIResponse<T>> {
	const realUrl = PrependTachiUrl(url, "1");
	const logUrl = `${method} ${realUrl}`;

	log.debug(`Making a request to ${logUrl}.`);

	try {
		const res = await fetch(realUrl, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: token ? `Bearer ${token}` : "",
				"User-Agent": USER_AGENT,
			},
			body: JSON.stringify(body),
		});

		const json: APIResponse<T> = (await res.json()) as unknown as APIResponse<T>;

		const contents = { ...json, statusCode: res.status };

		LogRequestResult(logUrl, contents);

		return contents;
	} catch (err) {
		log.error({ err }, `Failed while requesting ${method} ${realUrl}.`);

		// Throw the error upwards for it to be caught be a higher handler.
		throw err;
	}
}

/**
 * Performs a GET request against the Tachi server.
 *
 * @param url - The URL to request.
 * @param params - Any URL params for this request.
 * @param auth - Used to auth the requests against the API
 */
export async function TachiServerV1Get<T = unknown>(
	url: string,
	authToken: string | null,
	params: Record<string, string> = {},
): Promise<APIResponse<T>> {
	try {
		let authHeader = "";

		if (authToken) {
			authHeader = `Bearer ${authToken}`;
		}

		const urlParams = new URLSearchParams(params);

		const realUrl = `${PrependTachiUrl(url, "1")}?${urlParams.toString()}`;

		log.debug(`GET ${realUrl}`);

		const res = await fetch(realUrl, {
			method: RequestTypes.GET,
			headers: {
				Authorization: authHeader,
				"User-Agent": USER_AGENT,
			},
		});

		const json: APIResponse<T> = (await res.json()) as unknown as APIResponse<T>;
		const contents = { ...json, statusCode: res.status };

		LogRequestResult(`GET ${realUrl}`, contents);

		return contents;
	} catch (err) {
		log.error(`Failed while requesting GET ${url}.\n\n${err}\n`);

		throw err;
	}
}

/**
 * Takes a url like "/hello" or "bar" and converts it to "https://tachi-server.com/api/v1/hello" or "https://tachi-server.com/api/v1/bar".
 */
export function PrependTachiUrl(url: string, version: "1" = "1"): string {
	if (!url.startsWith("/")) {
		url = `/${url}`;
	}

	return `${Env.TACHI_SERVER_LOCATION}/api/v${version}${url}`;
}

/**
 * Logs the result of a request.
 * Logs at WARN level if was unsuccessful, DEBUG otherwise.
 */
function LogRequestResult(logUrl: string, res: APIResponse<unknown>): void {
	if (!res.success) {
		log.warn(`Request ${logUrl} was unsuccessful: ${res.description} (${res.statusCode})`);
	} else {
		log.debug(`Request ${logUrl} was successful: ${res.description} (${res.statusCode})`);
	}
}
