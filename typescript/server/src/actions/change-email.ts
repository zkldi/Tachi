import { MakeAction } from "#lib/actions/actions";
import { PasswordCompare } from "#lib/auth/auth";
import { SendEmail } from "#lib/email/client";
import { EmailFormatVerifyEmail } from "#lib/email/formats";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { CheckIfEmailInUse } from "#utils/user";
import { ExpectedErr, log } from "bliss";

export const ACTION_ChangeEmail = MakeAction(
	"CHANGE_EMAIL",
	async (taker, { "!email": email, "!password": password }) => {
		await DB.transaction()
			.setIsolationLevel("serializable")
			.execute(async (txn) => {
				const pw = await txn
					.selectFrom("priv_account_credential")
					.select("password")
					.where("user_id", "=", taker.acct.id)
					.executeTakeFirstOrThrow();

				if (!pw) {
					throw new ExpectedErr(500, "User has no password?");
				}

				const isPasswordValid = await PasswordCompare(password, pw.password);

				if (!isPasswordValid) {
					throw new ExpectedErr(401, "Invalid password");
				}

				const existingEmail = await CheckIfEmailInUse(email);

				if (existingEmail) {
					log.info(`User attempted to change to email that was already in use.`);
					throw new ExpectedErr(409, "This email is already in use.");
				}

				await txn
					.updateTable("priv_account_credential")
					.set({
						email,
					})
					.where("user_id", "=", taker.acct.id)
					.execute();

				const resetEmailCode = Random20Hex();

				// clear out the previous email code!
				await DB.deleteFrom("priv_verify_email_token")
					.where("user_id", "=", taker.acct.id)
					.execute();

				await DB.insertInto("priv_verify_email_token")
					.values({
						email,
						token: resetEmailCode,
						user_id: taker.acct.id,
					})
					.execute();

				const { text, html } = EmailFormatVerifyEmail(taker.acct.username, resetEmailCode);

				void SendEmail(email, "Email Verification", html, text);
			});

		return {};
	},
);
