import { MakeAnonAction } from "#lib/actions/actions";
import { AddNewUser, ValidateCaptcha } from "#lib/auth/auth";
import { SendEmail } from "#lib/email/client";
import { EmailFormatVerifyEmail } from "#lib/email/formats";
import { Env, ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { CheckIfEmailInUse, GetUserCaseInsensitive } from "#utils/user";
import { ExpectedErr, log } from "bliss";
import crypto from "crypto";
import { sql } from "kysely";
import { type UserDocument } from "tachi-common";

/** Namespace for the advisory lock that serialises bootstrap-invite registrations. */
const BOOTSTRAP_INVITE_ADVISORY_KEY1 = 0x42_6f_6f_74; // "Boot"
const BOOTSTRAP_INVITE_ADVISORY_KEY2 = 0x49_6e_76_74; // "Invt"

function bootstrapCodeMatches(input: string, expected: string): boolean {
	const a = Buffer.from(input, "utf8");
	const b = Buffer.from(expected, "utf8");

	if (a.length !== b.length) {
		return false;
	}

	return crypto.timingSafeEqual(a, b);
}

export const ANON_ACTION_Register = MakeAnonAction(
	"REGISTER",
	async (
		taker,
		{
			"!email": email,
			"!password": password,
			"!inviteCode": inviteCode,
			username,
			"!captcha": captcha,
		},
	) => {
		// force lowercase for emails to avoid case-confusion in lookups...
		email = email.toLowerCase();

		if (Env.NODE_ENV === "production" || Env.NODE_ENV === "staging") {
			log.debug("Validating captcha...");

			if (taker.ip === null) {
				throw new ExpectedErr(400, `IP address is required to validate captcha.`);
			}

			const validCaptcha = await ValidateCaptcha(captcha, taker.ip);

			if (!validCaptcha) {
				throw new ExpectedErr(400, `Captcha failed.`);
			}
		} else {
			log.debug("Skipped captcha check because not in production.");
		}

		const existingUser = await GetUserCaseInsensitive(username);

		if (existingUser) {
			throw new ExpectedErr(409, `This username is already in use.`);
		}

		const existingEmail = await CheckIfEmailInUse(email);

		if (existingEmail) {
			throw new ExpectedErr(409, `This email is already in use.`);
		}

		const newUser = await DB.transaction().execute(async (txn): Promise<UserDocument> => {
			if (ServerConfig.INVITE_CODE_CONFIG) {
				if (!inviteCode) {
					throw new ExpectedErr(
						400,
						"No invite code given, yet the server uses invites.",
					);
				}
			}

			const isBootstrapInvite =
				ServerConfig.INVITE_CODE_CONFIG &&
				ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE &&
				inviteCode !== null &&
				bootstrapCodeMatches(inviteCode, ServerConfig.INVITE_ADMIN_INITIAL_INVITE_CODE);

			if (isBootstrapInvite) {
				await sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_INVITE_ADVISORY_KEY1}, ${BOOTSTRAP_INVITE_ADVISORY_KEY2})`.execute(
					txn,
				);

				const { count } = await txn
					.selectFrom("account")
					.select(txn.fn.countAll().as("count"))
					.executeTakeFirstOrThrow();

				if (Number(count) > 0) {
					log.info("Bootstrap invite used but instance already has users.");
					throw new ExpectedErr(400, `Invalid invite code given: ${inviteCode}.`);
				}
			} else if (ServerConfig.INVITE_CODE_CONFIG) {
				// Validate the invite code BEFORE creating the user so a bad code
				// never burns a sequence value on `account.id`.
				// FOR UPDATE locks the row so a concurrent signup can't consume
				// the same code between our check and the update below.
				const inviteCodeDoc = await txn
					.selectFrom("priv_invite")
					.select("priv_invite.code")
					.where("priv_invite.code", "=", inviteCode!)
					.where("priv_invite.consumed", "=", false)
					.forUpdate()
					.executeTakeFirst();

				if (!inviteCodeDoc) {
					log.info(`Invalid invite code given: ${inviteCode}.`);
					throw new ExpectedErr(400, `Invalid invite code given: ${inviteCode}.`);
				}
			}

			const { newUser, newSettings: _ } = await AddNewUser(txn, username, password, email);

			if (isBootstrapInvite) {
				await txn
					.updateTable("account")
					.set({ auth_level: "admin" })
					.where("account.id", "=", newUser.id)
					.execute();

				log.info(
					`Bootstrap invite consumed — user ${newUser.username} (${newUser.id}) is now admin.`,
				);
			} else if (ServerConfig.INVITE_CODE_CONFIG) {
				log.info(`Consumed invite ${inviteCode}.`);

				await txn
					.updateTable("priv_invite")
					.set({
						consumed: true,
						consumed_at: new Date().toISOString(),
						consumed_by: newUser.id,
					})
					.where("priv_invite.code", "=", inviteCode!)
					.execute();
			}

			const resetEmailCode = Random20Hex();

			await txn
				.insertInto("priv_verify_email_token")
				.values({
					token: resetEmailCode,
					user_id: newUser.id,
					email,
				})
				.execute();

			// TODO: Put this on job queue
			const { text, html } = EmailFormatVerifyEmail(newUser.username, resetEmailCode);

			void SendEmail(email, "Email Verification", html, text);

			return newUser;
		});

		return {
			userID: newUser.id,
		};
	},
);
