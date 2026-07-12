import type { RequestHandler, Response } from "express-serve-static-core";
import type { APITokenDocument } from "tachi-common";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { log } from "#lib/log/log";
import { TachiConfig } from "#lib/setup/config";

// https://stackoverflow.com/a/64546368/11885828
// Taken from Jonathan Turnock - This is an *incredibly* nice
// solution for post-request express logging!

const ResJsonInteceptor = (res: Response, json: Response["json"]) => (content: unknown) => {
	// @ts-expect-error general monkeypatching error
	res.contentBody = content;
	res.json = json;
	res.json(content);
};

export const RequestLoggerMiddleware: RequestHandler = (req, res, next) => {
	const safeBody: Record<string, unknown> = {};

	for (const [k, v] of Object.entries(req.safeBody)) {
		// Keys that start with ! are private information,
		// and should not ever be logged.
		if (k.startsWith("!")) {
			safeBody[k] = "[OMITTED]";
		} else {
			safeBody[k] = v;
		}
	}

	log.debug(
		{
			query: req.query,
			body: safeBody,
		},
		`Received request ${req.method} ${req.originalUrl}.`,
	);

	// @ts-expect-error we're doing some wacky monkey patching
	res.json = ResJsonInteceptor(res, res.json);

	res.on("finish", () => {
		// special overrides
		// This stuff is spam, so we'll just not log it.
		if (res.statusCode === 429) {
			return;
		}

		// 403 bannings like this are also spam.
		// @ts-expect-error we're doing some monkey patching - contentBody is what we're returning.
		if (res.contentBody?.description === `You are banned from ${TachiConfig.NAME}.`) {
			return;
		}

		// @ts-expect-error set by {@link ResJsonInteceptor} when handlers use `res.json`
		const responseBody: unknown | undefined = res.contentBody;

		const contents = {
			statusCode: res.statusCode,
			requestQuery: req.query,
			requestBody: safeBody,
			// Explains validation/import failures etc.; otherwise logs only show the status code.
			...(responseBody !== undefined && res.statusCode >= 400 && { responseBody }),

			// This might actually be undefined, as it could be called in some weird scenarios?
			from: (req[SYMBOL_TACHI_API_AUTH] as APITokenDocument | undefined)?.userID ?? null,
			fromIp: req.ip,
		};

		if (res.statusCode < 400 || res.statusCode === 404) {
			let level: "debug" | "info";

			if (req.url.includes("/ir/")) {
				level = "info";
			} else {
				level = "debug";
			}

			log[level](contents, `(${req.method} ${req.originalUrl}) Returned ${res.statusCode}.`);
		} else if (res.statusCode < 500) {
			log.info(contents, `(${req.method} ${req.originalUrl}) Returned ${res.statusCode}.`);
		} else {
			log.error(contents, `(${req.method} ${req.originalUrl}) Returned ${res.statusCode}.`);
		}
	});

	next();
};
