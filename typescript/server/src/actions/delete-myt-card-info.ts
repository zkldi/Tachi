import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";

export const ACTION_DeleteMytCardInfo = MakeAction(
	"DELETE_MYT_CARD_INFO",
	async (taker, _input) => {
		await DB.deleteFrom("priv_svc_myt_card_info")
			.where("user_id", "=", taker.acct.id)
			.execute();

		return {};
	},
);
