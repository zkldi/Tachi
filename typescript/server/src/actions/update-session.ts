import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_UpdateSession = MakeAction("UPDATE_SESSION", async (taker, input) => {
	const hasUpdate =
		input.name !== undefined || input.desc !== undefined || input.highlight !== undefined;

	if (!hasUpdate) {
		throw new ExpectedErr(400, "This request modifies nothing about this session.");
	}

	const row = await DB.selectFrom("session")
		.select(["id", "user_id"])
		.where("id", "=", input.sessionID)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, "This session does not exist.");
	}

	if (row.user_id !== taker.acct.id) {
		throw new ExpectedErr(403, "You are not authorised to modify this session.");
	}

	const set: { description?: string | null; highlight?: boolean; name?: string } = {};

	if (input.name !== undefined) {
		set.name = input.name;
	}

	if (input.desc !== undefined) {
		set.description = input.desc;
	}

	if (input.highlight !== undefined) {
		set.highlight = input.highlight;
	}

	await DB.updateTable("session").set(set).where("id", "=", input.sessionID).execute();

	return {};
});
