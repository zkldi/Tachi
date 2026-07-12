import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";

export const ACTION_UpdateCgCardInfo = MakeAction(
	"UPDATE_CG_CARD_INFO",
	async (taker, { service, cardID, pin }) => {
		await DB.insertInto("priv_svc_cg_card_info")
			.values({
				user_id: taker.acct.id,
				service,
				card_id: cardID,
				pin,
			})
			.onConflict((oc) =>
				oc.columns(["user_id", "service"]).doUpdateSet({
					card_id: cardID,
					pin,
				}),
			)
			.execute();

		return {};
	},
);
