import { log } from "#lib/log/log";
import { Env, ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import nodeFetch from "#utils/fetch";
import { Random20Hex } from "#utils/misc";
import { FormatUserDoc } from "#utils/user";
import bcrypt from "bcryptjs";
import { type Transaction } from "kysely";
import { p } from "prudence";
import {
	type integer,
	type InviteCodeDocument,
	UserAuthLevels,
	type UserDocument,
	type UserSettingsDocument,
} from "tachi-common";
import { type Database } from "tachi-db";

export const ValidatePassword = (self: unknown) =>
	(typeof self === "string" && self.length >= 8) || "Passwords must be 8 characters or more.";

const LAZY_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export const ValidateEmail = p.regex(LAZY_EMAIL_REGEX);

/**
 * Compares a plaintext string of a users password to a hash.
 * @param plaintext The provided user input.
 * @param password The hash to compare against.
 */
export function PasswordCompare(plaintext: string, password: string) {
	return bcrypt.compare(plaintext, password);
}

export function ReinstateInvite(code: string) {
	log.info(`Reinstated Invite ${code}`);

	return DB.updateTable("priv_invite")
		.set({
			consumed: false,
			consumed_at: null,
			consumed_by: null,
		})
		.where("code", "=", code)
		.execute();
}

export async function AddNewInvite(user: UserDocument): Promise<InviteCodeDocument> {
	const code = Random20Hex();

	await DB.insertInto("priv_invite")
		.values({
			code,
			consumed: false,
			created_by: user.id,
			created_at: new Date().toISOString(),
			consumed_at: null,
			consumed_by: null,
		})
		.execute();

	log.info(`User ${FormatUserDoc(user)} created an invite.`);

	return {
		code,
		createdBy: user.id,
		createdAt: Date.now(),
		consumed: false,
		consumedAt: null,
		consumedBy: null,
	};
}

export const DEFAULT_USER_SETTINGS: UserSettingsDocument["preferences"] = {
	developerMode: false,
	advancedMode: false,
	invisible: false,
	contentiousContent: false,
	deletableScores: false,
};

export function HashPassword(plaintext: string) {
	return bcrypt.hash(plaintext, Env.BCRYPT_SALT_ROUNDS);
}

export async function AddNewUser(
	txn: Transaction<Database>,
	username: string,
	plaintext: string,
	email: string,
): Promise<{ newSettings: UserSettingsDocument; newUser: UserDocument }> {
	const hashedPassword = await HashPassword(plaintext);

	log.debug(`Hashed password for ${username}.`);

	const userID = await txn
		.insertInto("account")
		.values({
			about: "I'm a fairly nondescript person.",
			username,
			joined: new Date().toISOString(),
			last_seen: new Date().toISOString(),
			auth_level: "user",
			custom_pfp_location: null,
			custom_banner_location: null,
		})
		.returning("id")
		.executeTakeFirstOrThrow()
		.then((res) => res.id);

	const userDoc: UserDocument = {
		id: userID,
		username,
		usernameLowercase: username.toLowerCase(),
		about: "I'm a fairly nondescript person.",
		socialMedia: {},
		status: null,
		customBannerLocation: null,
		customPfpLocation: null,
		joinDate: Date.now(),
		lastSeen: Date.now(),
		authLevel: UserAuthLevels.USER,
		badges: [],
	};

	const settingsRes = await InsertDefaultUserSettings(txn, userID);

	await InsertPrivateUserInfo(txn, userID, hashedPassword, email);

	return { newUser: userDoc, newSettings: settingsRes };
}

export function InsertPrivateUserInfo(
	txn: Transaction<Database>,
	userID: integer,
	hashedPassword: string,
	email: string,
) {
	return txn
		.insertInto("priv_account_credential")
		.values({
			user_id: userID,
			email,
			password: hashedPassword,
		})
		.execute();
}

export async function InsertDefaultUserSettings(
	txn: Transaction<Database>,
	userID: integer,
): Promise<UserSettingsDocument> {
	log.debug(`Inserting default settings for ${userID}.`);

	await txn
		.insertInto("account_settings")
		.values({
			user_id: userID,
			pf_invisible: DEFAULT_USER_SETTINGS.invisible,
			pf_developer_mode: DEFAULT_USER_SETTINGS.developerMode,
			pf_advanced_mode: DEFAULT_USER_SETTINGS.advancedMode,
			pf_contentious_content: DEFAULT_USER_SETTINGS.contentiousContent,
			pf_deletable_scores: DEFAULT_USER_SETTINGS.deletableScores,
		})
		.execute();

	return {
		userID,
		following: [],
		preferences: DEFAULT_USER_SETTINGS,
	};
}

export async function ValidateCaptcha(
	captchaResponse: string,
	remoteAddr: string | undefined,
	fetch = nodeFetch,
) {
	const verifyRes: unknown = await fetch("https://api.hcaptcha.com/siteverify", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			secret: ServerConfig.CAPTCHA_SECRET_KEY,
			response: captchaResponse,
			remoteip: remoteAddr ?? "",
		}),
	}).then((r) => r.json());

	const err = p(
		verifyRes,
		{
			success: "boolean",
		},
		{},
		{ allowExcessKeys: true },
	);

	if (err) {
		log.warn(
			{ err, verifyRes },
			`hCaptcha returned something without a success property? Assuming this captcha check failed.`,
		);
		return false;
	}

	const hcr = verifyRes as { "error-codes"?: string[]; success: boolean };

	if (!hcr.success) {
		log.debug({ errorCodes: hcr["error-codes"], hcr }, `Failed hCaptcha response`);
	}

	return hcr.success;
}

export function MountAuthCookie(
	req: Express.Request,
	user: UserDocument,
	settings: UserSettingsDocument,
) {
	req.session.tachi = {
		user,
		settings,
	};

	req.session.cookie.maxAge = 3.154e10;
}
