import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_DeleteApiClient = MakeAction(
	"DELETE_API_CLIENT",
	async (taker, { clientID }) => {
		const existing = await DB.selectFrom("priv_api_client")
			.select(["client_id", "author"])
			.where("client_id", "=", clientID)
			.executeTakeFirst();

		if (!existing) {
			throw new ExpectedErr(404, "This client does not exist.");
		}

		if (existing.author !== taker.acct.id) {
			throw new ExpectedErr(403, "You are not authorized to perform this action.");
		}

		await DB.deleteFrom("priv_api_token").where("from_oauth2_client", "=", clientID).execute();

		await DB.deleteFrom("priv_api_client").where("client_id", "=", clientID).execute();

		return {};
	},
);
