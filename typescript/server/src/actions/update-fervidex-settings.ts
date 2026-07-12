import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";

export const ACTION_UpdateFervidexSettings = MakeAction(
	"UPDATE_FERVIDEX_SETTINGS",
	async (taker, { cards, forceStaticImport }) => {
		// Read the current row so we can preserve untouched fields.
		const existing = await DB.selectFrom("svc_fer_settings")
			.select(["svc_fer_settings.force_static_import"])
			.where("user_id", "=", taker.acct.id)
			.executeTakeFirst();

		const newForceStaticImport = forceStaticImport ?? existing?.force_static_import ?? false;

		// Always upsert the settings row so priv_svc_fer_card can reference it.
		await DB.insertInto("svc_fer_settings")
			.values({ user_id: taker.acct.id, force_static_import: newForceStaticImport })
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({ force_static_import: newForceStaticImport }),
			)
			.execute();

		// Update card filters only when the caller explicitly supplied them.
		let newCards: Array<string> | null;

		if (cards !== undefined) {
			await DB.deleteFrom("priv_svc_fer_card").where("user_id", "=", taker.acct.id).execute();

			if (cards !== null && cards.length > 0) {
				await DB.insertInto("priv_svc_fer_card")
					.values(cards.map((card_id) => ({ user_id: taker.acct.id, card_id })))
					.execute();

				newCards = cards;
			} else {
				newCards = null;
			}
		} else {
			const cardRows = await DB.selectFrom("priv_svc_fer_card")
				.select(["priv_svc_fer_card.card_id"])
				.where("user_id", "=", taker.acct.id)
				.execute();

			newCards = cardRows.length > 0 ? cardRows.map((r) => r.card_id) : null;
		}

		return {
			userID: taker.acct.id,
			cards: newCards,
			forceStaticImport: newForceStaticImport,
		};
	},
);
