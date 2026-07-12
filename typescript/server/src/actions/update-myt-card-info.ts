import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";

export const ACTION_UpdateMytCardInfo = MakeAction(
	"UPDATE_MYT_CARD_INFO",
	async (taker, { cardAccessCode }) => {
		await DB.insertInto("priv_svc_myt_card_info")
			.values({ user_id: taker.acct.id, card_access_code: cardAccessCode })
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({ card_access_code: cardAccessCode }),
			)
			.execute();

		return {};
	},
);
