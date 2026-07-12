import type { RequestHandler } from "express";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { log } from "#lib/log/log";
import { IsNullish } from "#utils/misc";
import { REQ_AssignToReqTachiData, REQ_GetTachiData } from "#utils/req-tachi-data";
import { GetUserWithID, ResolveUser } from "#utils/user";
import { UserAuthLevels } from "tachi-common";

export const GetUserFromParam: RequestHandler = async (req, res, next) => {
	if (!req.params.userID) {
		return res.status(400).json({
			success: false,
			description: "No userID given.",
		});
	}

	let userID = req.params.userID;

	if (req.params.userID === "me") {
		const authUserID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (authUserID === null) {
			return res.status(401).json({
				success: false,
				description: "Cannot use 'me' userID with no authentication.",
			});
		}

		// fast assign using JWT
		if (req.session.tachi?.user) {
			REQ_AssignToReqTachiData(req, { requestedUser: req.session.tachi.user });
			next();
			return;
		}

		userID = authUserID.toString();
	}

	const user = await ResolveUser(userID);

	if (!user) {
		return res.status(404).json({
			success: false,
			description: `The user ${userID} does not exist.`,
		});
	}

	REQ_AssignToReqTachiData(req, { requestedUser: user });

	next();
};

/**
 * Require the user making this request to also be the user in the :userID param.
 */
export const RequireAuthedAsUser: RequestHandler = async (req, res, next) => {
	const user = REQ_GetTachiData(req, "requestedUser");

	const requestingUserID = req[SYMBOL_TACHI_API_AUTH].userID;

	if (requestingUserID === null) {
		return res.status(401).json({
			success: false,
			description: `Authentication is required for this endpoint.`,
		});
	}

	const requestingUser = await GetUserWithID(requestingUserID);

	if (!requestingUser) {
		log.error(`${requestingUserID} is signed in as someone who does not exist.`);
		return res.status(500).json({
			success: false,
			description: `You are signed in as someone who does not exist.`,
		});
	}

	// admins can do whatever.
	if (requestingUser.authLevel === UserAuthLevels.ADMIN) {
		next();
		return;
	}

	if (requestingUserID !== user.id) {
		return res.status(403).json({
			success: false,
			description: "You are not authorised as this user.",
		});
	}

	next();
};

/**
 * Require that this request is made with a Cookie, instead of any
 * API key. This is for things that services should not be allowed to
 * alter/access, like integration information.
 */
export const RequireSelfRequestFromUser: RequestHandler = (req, res, next) => {
	const user = REQ_GetTachiData(req, "requestedUser");

	if (req[SYMBOL_TACHI_API_AUTH].userID === null) {
		return res.status(401).json({
			success: false,
			description: `This endpoint requires session-level authentication.`,
		});
	}

	if (IsNullish(req.session.tachi?.user.id) || req[SYMBOL_TACHI_API_AUTH].userID !== user.id) {
		return res.status(403).json({
			success: false,
			description: `This request cannot be performed by an API key, and requires authentication.`,
		});
	}

	next();
};
