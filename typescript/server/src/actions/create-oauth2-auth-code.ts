import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";

export const ACTION_CreateOAuth2AuthCode = MakeAction("CREATE_OAUTH2_AUTH_CODE", async (taker) => {
	const code = Random20Hex();
	const createdOn = Date.now();

	await DB.insertInto("priv_oauth2_auth_token")
		.values({
			token: code,
			user_id: taker.acct.id,
			created_on: new Date(createdOn).toISOString(),
		})
		.execute();

	return {
		code,
		userID: taker.acct.id,
		createdOn,
	};
});
