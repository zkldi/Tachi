import { MakeAction } from "#lib/actions/actions";
import { CDNDelete } from "#lib/cdn/cdn";
import { GetProfilePictureURL } from "#lib/cdn/url-format";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_DeletePfp = MakeAction("DELETE_PFP", async (taker) => {
	const account = await DB.selectFrom("account")
		.select("custom_pfp_location")
		.where("id", "=", taker.acct.id)
		.executeTakeFirstOrThrow();

	if (!account.custom_pfp_location) {
		throw new ExpectedErr(404, "You do not have a custom profile picture to delete.");
	}

	await CDNDelete(GetProfilePictureURL(taker.acct.id, account.custom_pfp_location));

	await DB.updateTable("account")
		.set({ custom_pfp_location: null })
		.where("id", "=", taker.acct.id)
		.execute();

	return {};
});
