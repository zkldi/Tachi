import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";

export const ACTION_RevokeKaiAuthToken = MakeAction(
	"REVOKE_KAI_AUTH_TOKEN",
	async (taker, { service }) => {
		await DB.deleteFrom("priv_svc_kai_auth_token")
			.where("user_id", "=", taker.acct.id)
			.where("service", "=", service)
			.execute();

		return {};
	},
);
