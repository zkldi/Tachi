import { MakeAction } from "#lib/actions/actions";
import { upsertKaiAuthTokensInDb } from "#lib/kai-auth-token/persist";
import DB from "#services/pg/db";

export const ACTION_UpsertKaiAuthToken = MakeAction(
	"UPSERT_KAI_AUTH_TOKEN",
	async (taker, { service, token, refreshToken }) => {
		await upsertKaiAuthTokensInDb(DB, taker.acct.id, service, token, refreshToken);

		return {};
	},
);
