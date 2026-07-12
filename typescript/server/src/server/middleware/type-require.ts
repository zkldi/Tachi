import type { RequestHandler } from "express-serve-static-core";

import { Env, ServerConfig, TachiConfig } from "#lib/setup/config";

/**
 * Middleware that makes the route only available under Bokutachi.
 * Note that if the special type "omni" is set (which is set for testing/dev purposes)
 * this restriction is bypassed.
 */
export const RequireBokutachi: RequestHandler = (req, res, next) => {
	if (TachiConfig.TYPE === "boku" || TachiConfig.TYPE === "omni") {
		next();
		return;
	}

	return res.status(404).send({
		success: false,
		description: `The route ${req.url} is only available on Bokutachi.`,
	});
};

/**
 * Middleware that makes the route only available under Kamaitachi.
 * Note that if the special type "omni" is set (which is set for testing/dev purposes)
 * this restriction is bypassed.
 */
export const RequireKamaitachi: RequestHandler = (req, res, next) => {
	if (TachiConfig.TYPE === "kamai" || TachiConfig.TYPE === "omni") {
		next();
		return;
	}

	return res.status(404).send({
		success: false,
		description: `The route ${req.url} is only available on Kamaitachi.`,
	});
};

export const RequireInvitesEnabled: RequestHandler = (req, res, next) => {
	if (ServerConfig.INVITE_CODE_CONFIG) {
		next();
		return;
	}

	return res.status(404).json({
		success: false,
		description: `The route ${req.url} is only available if invites are enabled.`,
	});
};

/**
 * Makes a route only available in local development or in testing.
 *
 * This is intended for utils that interact frivolously with the host system,
 * such as the seeds-api, which fetches local data from the user's hard drive
 * at an expected checkout location.
 */
export const RequireLocalDevelopment: RequestHandler = (req, res, next) => {
	if (Env.NODE_ENV === "dev" || Env.NODE_ENV === "test") {
		next();
		return;
	}

	return res.status(404).send({
		success: false,
		description: `The route ${req.url} is only available in local development or testing environments.`,
	});
};
