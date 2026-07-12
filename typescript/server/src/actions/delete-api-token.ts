import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_DeleteApiToken = MakeAction("DELETE_API_TOKEN", async (taker, { token }) => {
	const existing = await DB.selectFrom("priv_api_token")
		.select("token")
		.where("token", "=", token)
		.where("user_id", "=", taker.acct.id)
		.executeTakeFirst();

	if (!existing) {
		throw new ExpectedErr(404, "This key does not exist.");
	}

	await DB.deleteFrom("priv_api_token").where("token", "=", token).execute();

	return {};
});
