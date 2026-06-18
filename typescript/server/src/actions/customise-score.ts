import { MakeAction } from "#lib/actions/actions";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";

export const ACTION_CustomiseScore = MakeAction("CUSTOMISE_SCORE", async (_taker, input) => {
	if (input.comment === undefined && input.highlight === undefined) {
		throw new ExpectedErr(400, "This request modifies nothing about the score.");
	}

	await DB.transaction().execute(async (trx) => {
		const scoreRow = await trx
			.selectFrom("raw_score")
			.select(["chart_id", "user_id"])
			.where("id", "=", input.scoreID)
			.executeTakeFirst();

		if (!scoreRow) {
			throw new ExpectedErr(404, "This score does not exist.");
		}

		const setScore: { comment?: string | null; highlight?: boolean } = {};

		if (input.comment !== undefined) {
			setScore.comment = input.comment;
		}

		if (input.highlight !== undefined) {
			setScore.highlight = input.highlight;
		}

		await trx.updateTable("raw_score").set(setScore).where("id", "=", input.scoreID).execute();

		if (input.highlight === true || input.highlight === false) {
			await trx
				.updateTable("pb")
				.set({ highlight: input.highlight })
				.where("user_id", "=", scoreRow.user_id)
				.where("chart_id", "=", scoreRow.chart_id)
				.execute();
		}
	});

	return {};
});
