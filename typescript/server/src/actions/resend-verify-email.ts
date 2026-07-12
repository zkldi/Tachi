import { MakeAction } from "#lib/actions/actions";
import { SendEmail } from "#lib/email/client";
import { EmailFormatVerifyEmail } from "#lib/email/formats";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { log } from "bliss";

export const ACTION_ResendVerifyEmail = MakeAction("RESEND_VERIFY_EMAIL", async (taker, {}) => {
	const verifyInfo = await DB.selectFrom("priv_verify_email_token")
		.select("email")
		.where("user_id", "=", taker.acct.id)
		.executeTakeFirst();

	if (!verifyInfo) {
		log.warn(
			`Attempted to send reset email to ${taker.acct.username}, but they've already verified their email.`,
		);
		return {};
	}

	const newToken = Random20Hex();

	await DB.updateTable("priv_verify_email_token")
		.where("user_id", "=", taker.acct.id)
		.set({
			token: newToken,
		})
		.executeTakeFirstOrThrow();

	// Send the email again.

	const { text, html } = EmailFormatVerifyEmail(taker.acct.username, newToken);

	await SendEmail(verifyInfo.email, "Email Verification", html, text);
	return {};
});
