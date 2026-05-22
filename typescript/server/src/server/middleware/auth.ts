import type { RequestHandler } from "express";
import type { Session, SessionData } from "express-session";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { SELECT_API_TOKEN, ToAPITokenDocument } from "#lib/db-formats/api-token";
import { log } from "#lib/log/log";
import { TachiConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { IsNullishOrEmptyStr, SplitAuthorizationHeader } from "#utils/misc";
import { IsUserBanned } from "#utils/user";
import { ALL_PERMISSIONS, type APIPermissions, type APITokenDocument } from "tachi-common";

const GuestToken: APITokenDocument = {
	token: null,
	userID: null,
	identifier: "Guest Token",
	permissions: {},
	fromAPIClient: null,
};

export const RejectIfBanned: RequestHandler = async (req, res, next) => {
	// auth might not be defined.
	const auth = req[SYMBOL_TACHI_API_AUTH] as APITokenDocument | undefined;

	// this is deliberately not auth?.userID !== null, as that isn't correct.
	// we need to ignore this if auth doesn't exist and if auth is null.

	if (auth && auth.userID !== null) {
		const isBanned = await IsUserBanned(auth.userID);

		if (isBanned) {
			return res.status(403).json({
				success: false,
				description: `You are banned from ${TachiConfig.NAME}`,
			});
		}
	}

	next();
};

/**
 * Sets the permissions for this request, alongside the user that is making the request.
 *
 * If this request was made with a valid Session Token, then a "self-key" is
 * set as the request token.
 *
 * If this request was made with a valid Authorization: Bearer <token>, then the
 * corresponding key is set as the request token.
 *
 * If this request was made with no auth headers or session tokens, then a guest
 * token is set as the request token, with no permissions.
 *
 * This is set on req[SYMBOL_TachiAPIAuth].
 *
 * This returns an array -- one which calls "reject if banned" immediately afterwards
 * as, if we've validated a user to exist, we should check if they're banned immediately
 * afterwards.
 */
function CreateSetRequestPermissions(errorKeyName: string): Array<RequestHandler> {
	return [
		async (req, res, next) => {
			// Types here are wrong. Sometimes req.session is not set.
			// As such, we force an assertion.

			const maybeSession = req.session as (Partial<SessionData> & Session) | undefined;

			if (maybeSession?.tachi?.user.id !== undefined) {
				req[SYMBOL_TACHI_API_AUTH] = {
					userID: maybeSession.tachi.user.id,
					identifier: `Session-Key ${maybeSession.tachi.user.id}`,
					token: null,
					permissions: ALL_PERMISSIONS,
					fromAPIClient: null,
				};
				next();
				return;
			}

			const header = req.header("Authorization");

			// if no auth was attempted, default to the guest token.
			if (IsNullishOrEmptyStr(header)) {
				req[SYMBOL_TACHI_API_AUTH] = GuestToken;
				next();
				return;
			}

			const { token, type } = SplitAuthorizationHeader(header);

			if (type !== "Bearer") {
				return res.status(400).json({
					success: false,
					[errorKeyName]: "Invalid Authorization Type - Expected Bearer.",
				});
			}

			if (!token) {
				return res.status(401).json({
					success: false,
					[errorKeyName]: "Invalid token.",
				});
			}

			const apiTokenData = await DB.selectFrom("priv_api_token")
				.select(SELECT_API_TOKEN)
				.where("token", "=", token)
				.executeTakeFirst()
				.then((r) => (r ? ToAPITokenDocument(r) : null));

			if (!apiTokenData) {
				return res.status(401).json({
					success: false,
					[errorKeyName]:
						"The provided API token does not correspond with any key in the database.",
				});
			}

			req[SYMBOL_TACHI_API_AUTH] = {
				userID: apiTokenData.userID,
				token,
				permissions: apiTokenData.permissions,
				identifier: apiTokenData.identifier,
				fromAPIClient: apiTokenData.fromAPIClient,
			};

			next();
		},
		RejectIfBanned,
	];
}

export const SetRequestPermissions: Array<RequestHandler> =
	CreateSetRequestPermissions("description");

/**
 * An identical implementation of SetRequestPermissions, but returns
 * fervidex-style errors (error, instead of description).
 *
 * @see SetRequestPermissions
 */
export const SetFervidexStyleRequestPermissions: Array<RequestHandler> =
	CreateSetRequestPermissions("error");

/**
 * Returns a middleware that enforces the request has the necessary permissions.
 * @param perms - Rest Parameter. The set of permissions necessary to use this endpoint.
 * @returns A middleware function.
 */
export const RequirePermissions =
	(...perms: Array<APIPermissions>): RequestHandler =>
	(req, res, next) => {
		// This isn't possible on paper, but maybe some insane stuff has happened to lead this to happen.

		if (req[SYMBOL_TACHI_API_AUTH] === undefined) {
			log.error(`RequirePermissions middleware was hit without any TachiAPIAuthentication?`);

			return res.status(500).json({
				success: false,
				description: "An internal error has occurred.",
			});
		}

		if (req[SYMBOL_TACHI_API_AUTH].userID === null) {
			return res.status(401).json({
				success: false,
				description: `You are not authorised to perform this action.`,
			});
		}

		const missingPerms = [];

		for (const perm of perms) {
			if (req[SYMBOL_TACHI_API_AUTH].permissions[perm] !== true) {
				missingPerms.push(perm);
			}
		}

		if (missingPerms.length > 0) {
			log.info(
				`IP ${req.ip} - userID ${
					req[SYMBOL_TACHI_API_AUTH].userID
				} had insufficient permissions for request ${req.method} ${
					req.url
				}. ${missingPerms.join(", ")}`,
			);
			return res.status(403).json({
				success: false,
				description: `You are missing the following permissions necessary for this request: ${missingPerms.join(
					", ",
				)}`,
			});
		}

		next();
	};

const CreateRequireNotGuest =
	(errorKeyName: string): RequestHandler =>
	(req, res, next) => {
		// See above -- this isn't possible on paper, but I want to check it anyway.

		if (req[SYMBOL_TACHI_API_AUTH] === undefined) {
			log.error(`RequirePermissions middleware was hit without any TachiAPIData?`);
			return res.status(500).json({
				success: false,
				description: "An internal error has occurred.",
			});
		}

		if (req[SYMBOL_TACHI_API_AUTH].userID === null) {
			log.info(`Request to ${req.method} ${req.url} was attempted by guest.`);
			return res.status(401).json({
				success: false,
				[errorKeyName]: "This endpoint requires authentication.",
			});
		}

		next();
	};

export const RequireNotGuest: RequestHandler = CreateRequireNotGuest("description");

export const FervidexStyleRequireNotGuest: RequestHandler = CreateRequireNotGuest("error");
