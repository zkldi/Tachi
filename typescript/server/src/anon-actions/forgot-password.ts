import { MakeAnonAction } from "#lib/actions/actions";
import { SendEmail } from "#lib/email/client";
import { EmailFormatResetPassword } from "#lib/email/formats";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { GetUserWithIDGuaranteed } from "#utils/user";
import { ExpectedErr, log } from "bliss";

export const ANON_ACTION_ForgotPassword = MakeAnonAction(
	"FORGOT_PASSWORD",
	async (taker, { "!email": email }) => {
		if (taker.ip === null) {
			throw new ExpectedErr(400, "IP address is required to send a password reset email.");
		}

		email = email.toLowerCase();

		const userPrivateInfo = await DB.selectFrom("priv_account_credential")
			.select(["user_id", "email"])
			.where("email", "=", email)
			.executeTakeFirst();

		if (userPrivateInfo) {
			const user = await GetUserWithIDGuaranteed(userPrivateInfo.user_id);

			if (!user) {
				throw new Error(
					`User ${userPrivateInfo.user_id} has private information but no real account.`,
				);
			}

			const code = `M${Random20Hex()}`;

			await DB.insertInto("priv_password_reset_token")
				.values({
					token: code,
					user_id: user.id,
					created_on: new Date().toISOString(),
				})
				.execute();

			const { html, text } = EmailFormatResetPassword(user.username, code, taker.ip);

			void SendEmail(userPrivateInfo.email, "Reset Password", html, text);
		} else {
			log.info(
				`Silently rejected password reset request for ${email}, as no user has this email.`,
			);

			return {
				silentlyRejected: true,
			};
		}

		return {
			silentlyRejected: false,
		};
	},
);
