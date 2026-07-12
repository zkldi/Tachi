import { ACTION_ResendVerifyEmail } from "#actions/resend-verify-email";
import { ANON_ACTION_ForgotPassword } from "#anon-actions/forgot-password";
import { ANON_ACTION_Register } from "#anon-actions/register";
import { ANON_ACTION_ResetPassword } from "#anon-actions/reset-password";
import { ANON_ACTION_VerifyEmail } from "#anon-actions/verify-email";
import { MountAuthCookie, PasswordCompare, ValidateCaptcha } from "#lib/auth/auth";
import { log } from "#lib/log/log";
import { success, wrapExpressMiddleware } from "#lib/router/typed-router";
import { Env } from "#lib/setup/config";
import {
	AggressiveRateLimitMiddleware,
	HyperAggressiveRateLimitMiddleware,
} from "#server/middleware/rate-limiter";
import {
	FormatUserDoc,
	GetSettingsForUser,
	GetUserCaseInsensitive,
	GetUserPrivateInfo,
	GetUserWithID,
} from "#utils/user";
import { ExpectedErr } from "bliss";

import { API_V1_ROUTER } from "../_singleton";

const aggressiveRL = wrapExpressMiddleware(AggressiveRateLimitMiddleware);
const hyperAggressiveRL = wrapExpressMiddleware(HyperAggressiveRateLimitMiddleware);

/**
 * Logs in a user.
 * @name POST /api/v1/auth/login
 */
API_V1_ROUTER.add("POST /auth/login", aggressiveRL, async ({ input, req, res }) => {
	if (req.session.tachi?.user.id !== undefined) {
		// Dual logins should destroy the users session and recreate it.
		req.session.tachi = undefined;
	}

	log.debug(`Received login request with username ${input.username} (${req.ip})`);

	/* istanbul ignore next */
	if (Env.NODE_ENV === "production" || Env.NODE_ENV === "staging") {
		log.debug("Validating captcha...");
		const validCaptcha = await ValidateCaptcha(input.captcha ?? "", req.socket.remoteAddress);

		if (!validCaptcha) {
			log.debug("Captcha failed.");
			res.status(400).json({ success: false, description: `Captcha failed.` });
			return success("Captcha failed.", {});
		}

		log.debug("Captcha validated!");
	} else {
		log.debug("Skipped captcha check because not in production.");
	}

	const requestedUser = await GetUserCaseInsensitive(input.username);

	if (!requestedUser) {
		log.debug(`Invalid username for login ${input.username}.`);
		throw new ExpectedErr(404, "This user does not exist.");
	}

	const privateInfo = await GetUserPrivateInfo(requestedUser.id);

	if (!privateInfo) {
		log.error(
			{ requestedUser },
			`State desync for user ${FormatUserDoc(requestedUser)}. This user has no password/email information?`,
		);
		throw new ExpectedErr(500, "An internal server error has occurred.");
	}

	const passwordMatch = await PasswordCompare(input["!password"], privateInfo.password);

	if (!passwordMatch) {
		log.debug("Invalid password provided.");
		throw new ExpectedErr(403, "Invalid password.");
	}

	const user = await GetUserWithID(requestedUser.id);

	if (!user) {
		log.error({ requestedUser }, `User logged in as someone who does not exist?`);
		throw new ExpectedErr(500, "An internal server error has occurred.");
	}

	const settings = await GetSettingsForUser(requestedUser.id);

	MountAuthCookie(req, user, settings);

	log.debug(`${FormatUserDoc(requestedUser)} Logged in.`);

	return success(`Successfully logged in as ${FormatUserDoc(requestedUser)}`, {
		userID: requestedUser.id,
	});
});

/**
 * Registers a new user.
 * @name POST /api/v1/auth/register
 */
API_V1_ROUTER.add("POST /auth/register", aggressiveRL, async ({ input, req }) => {
	const newUser = await ANON_ACTION_Register(
		{ ip: req.ip },
		{
			"!email": input["!email"],
			"!password": input["!password"],
			"!inviteCode": input.inviteCode ?? null,
			"!captcha": input.captcha ?? "",
			username: input.username,
		},
	);

	const user = await GetUserWithID(newUser.userID);

	if (!user) {
		log.error(
			`User ${newUser.userID} does not have a user document, but one was just created.`,
		);
		throw new ExpectedErr(500, "An internal server error has occurred.");
	}

	const settings = await GetSettingsForUser(user.id);

	MountAuthCookie(req, user, settings);

	return success(`Successfully created account ${input.username}!`, user);
});

/**
 * Verifies the provided email according to the code provided.
 *
 * @param code - The emailCode set in the /register function.
 *
 * @name POST /api/v1/auth/verify-email
 */
API_V1_ROUTER.add("POST /auth/verify-email", aggressiveRL, async ({ input, req }) => {
	await ANON_ACTION_VerifyEmail({ ip: req.ip }, { code: input.code });

	return success("Verified email!", {});
});

/**
 * Resend a verification email, for when they fall through the cracks.
 *
 * @name POST /api/v1/auth/resend-verify-email
 */
API_V1_ROUTER.add("POST /auth/resend-verify-email", hyperAggressiveRL, async ({ req, res }) => {
	// Immediately send a response so the existence of emails
	// cannot be timing attacked out.
	res.status(200).json({
		success: true,
		description: `Sent an email if the email address has not been verified.`,
		body: {},
	});

	const user = req.session.tachi?.user;

	if (!user) {
		return success("Sent an email if the email address has not been verified.", {});
	}

	await ACTION_ResendVerifyEmail(
		{ ip: req.ip, acct: { id: user.id, username: user.username } },
		{},
	);

	return success("Sent an email if the email address has not been verified.", {});
});

/**
 * Logs out the requesting user.
 * @name POST /api/v1/auth/logout
 */
API_V1_ROUTER.add("POST /auth/logout", ({ req, res }) => {
	if (req.session.tachi?.user.id === undefined) {
		res.status(409).json({ success: false, description: `You are not logged in.` });
		return success("You are not logged in.", {});
	}

	req.session.destroy(() => 0);

	return success("Logged Out.", {});
});

/**
 * Creates a password reset code for a user.
 *
 * @param !email - The email associated with the account you want to reset.
 *
 * @name POST /api/v1/auth/forgot-password
 */
API_V1_ROUTER.add("POST /auth/forgot-password", hyperAggressiveRL, async ({ input, req, res }) => {
	// For timing attack and infosec reasons, respond immediately.
	res.status(202).json({
		success: true,
		description: "A code has been sent to your email.",
		body: {},
	});

	try {
		await ANON_ACTION_ForgotPassword({ ip: req.ip }, { "!email": input["!email"] });
	} catch (_err) {
		// error is logged elsewhere.
	}

	return success("A code has been sent to your email.", {});
});

/**
 * Takes a code generated from /forgot-password, a new password, and performs the reset.
 *
 * @param password - The users new password.
 * @param code - The code to use to reset this password.
 *
 * @name POST /api/v1/auth/reset-password
 */
API_V1_ROUTER.add("POST /auth/reset-password", aggressiveRL, async ({ input, req }) => {
	await ANON_ACTION_ResetPassword(
		{ ip: req.ip },
		{ code: input.code, "!password": input["!password"] },
	);

	return success("Reset your password.", {});
});
