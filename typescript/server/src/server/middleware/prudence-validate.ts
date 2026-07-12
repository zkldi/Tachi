import type { RequestHandler } from "express-serve-static-core";

import { log } from "#lib/log/log";
import {
	type ErrorMessages,
	type MiddlewareErrorHandler,
	p,
	type PrudenceOptions,
	type PrudenceSchema,
} from "prudence";

export function TruncateString(string: string, len = 30) {
	if (string.length < len) {
		return string;
	}

	return `${string.substring(0, len - 3)}...`;
}

export const PrudenceErrorFormatter = (
	message: string,
	stringVal: string | null,
	keychain: string | null,
) => `[${keychain}] ${message}${stringVal ? ` (Received ${TruncateString(stringVal, 100)})` : ""}`;

const API_ERR_HANDLER =
	(logLevel: TachiLogLevels): MiddlewareErrorHandler =>
	(req, res, _next, error) => {
		let stringVal = error.userVal;

		if (error.keychain?.startsWith("!") === true && error.userVal !== undefined) {
			stringVal = "****";
		}

		if (typeof stringVal === "object" && stringVal !== null) {
			// this is probably null-prototype
			stringVal = null;
		} else if (stringVal === undefined) {
			stringVal = "nothing (undefined)";
		} else {
			stringVal = String(stringVal);
		}

		log[logLevel](
			{
				userVal: error.userVal,
				fullObj: req.method === "GET" ? req.query : req.safeBody,
			},
			`Prudence rejection: ${error.message}, ${stringVal} [K:${error.keychain}]`,
		);

		return res.status(400).json({
			success: false,
			description: PrudenceErrorFormatter(
				error.message,
				stringVal as string | null,
				error.keychain,
			),
		});
	};

// Cache all of the possible API_ERROR_HANDLERS to avoid function creation
// overhead at runtime.
const API_ERROR_HANDLERS = Object.fromEntries(
	(["error", "fatal", "info", "warn", "debug"] as const).map((e) => [e, API_ERR_HANDLER(e)]),
) as Record<TachiLogLevels, MiddlewareErrorHandler>;

type TachiLogLevels = "debug" | "error" | "fatal" | "info" | "warn";

const prValidate = (
	s: PrudenceSchema,
	errorMessage?: ErrorMessages,
	options?: Partial<PrudenceOptions>,
	level: TachiLogLevels = "info",
): RequestHandler => p.CurryMiddleware(API_ERROR_HANDLERS[level])(s, errorMessage, options);

export default prValidate;
