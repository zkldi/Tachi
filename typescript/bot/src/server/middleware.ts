import type { RequestHandler } from "express";

import { log } from "#utils/log";

import { Env } from "../config";

/**
 * Middleware that checks that a webhook request has Authorization set to
 * exactly "Bearer $CLIENT_SECRET".
 *
 * This is to prevent things like users spoofing webhook events.
 * $CLIENT_SECRET is part of the registered tachi OAuth2 client.
 */
export const ValidateWebhookRequest: RequestHandler = (req, res, next) => {
	const auth = req.header("Authorization");

	if (!auth) {
		log.info(`Received unauthed request from ${req.ip}.`);
		return res.status(401).json({
			success: false,
			description: "No authorization provided.",
		});
	}

	const [type, value] = auth.split(" ", 2);

	if (type !== "Bearer") {
		log.info(`Received invalid auth type request from ${req.ip}, got auth type ${type}.`);
		return res.status(400).json({
			success: false,
			description: "Invalid authorization type. Expected Bearer.",
		});
	}

	if (value !== Env.OAUTH_CLIENT_SECRET) {
		log.warn(`Recieved invalid auth value from ${req.ip}. Has the client secret been changed?`);
		return res.status(403).json({
			success: false,
			description: "Unauthorised.",
		});
	}

	log.debug("Webhook authorisation successful.");

	next();
};
