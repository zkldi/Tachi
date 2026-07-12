import { MakeAnonAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ANON_ACTION_VerifyEmail = MakeAnonAction("VERIFY_EMAIL", async (_taker, { code }) => {
	const exists = await DB.selectFrom("priv_verify_email_token")
		.select("priv_verify_email_token.user_id")
		.where("priv_verify_email_token.token", "=", code)
		.executeTakeFirst();

	if (!exists) {
		throw new ExpectedErr(400, "Invalid email verification code.");
	}

	await DB.deleteFrom("priv_verify_email_token")
		.where("priv_verify_email_token.token", "=", code)
		.execute();

	return {};
});
