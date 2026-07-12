import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { Random20Hex } from "#utils/misc";
import { GetClientByID } from "#utils/queries/api-clients";
import { ExpectedErr } from "bliss";

export const ACTION_ResetApiClientSecret = MakeAction(
	"RESET_API_CLIENT_SECRET",
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

		const newSecret = `CS${Random20Hex()}`;

		await DB.updateTable("priv_api_client")
			.set({ client_secret: newSecret })
			.where("client_id", "=", clientID)
			.execute();

		const updated = await GetClientByID(clientID);

		if (!updated) {
			throw new ExpectedErr(500, "Failed to retrieve updated client.");
		}

		return updated;
	},
);
