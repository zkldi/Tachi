import { ACTION_CustomiseScore } from "#actions/customise-score";
import { ACTION_DeleteScore } from "#actions/delete-score";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { GetChartsBySongId } from "#lib/db-formats/chart";
import { LoadScoreDocumentById } from "#lib/db-formats/score";
import { GetSongByID } from "#lib/db-formats/song";
import { log } from "#lib/log/log";
import { withScore, withScoreOwner } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";
import { GameToGameGroup } from "tachi-common";

/**
 * Retrieve the score document at this ID.
 *
 * @param getRelated - Gets the related song and chart document for this score, aswell.
 *
 * @name GET /api/v1/scores/:scoreID
 */
API_V1_ROUTER.add("GET /scores/:scoreID", withScore, async ({ input, ctx }) => {
	const { scoreDoc: score } = ctx;

	if (input.getRelated !== undefined) {
		const user = await GetUserWithID(score.userID);
		const songRes = await GetSongByID(GameToGameGroup(score.game), score.songID);
		const charts =
			songRes === undefined ? [] : await GetChartsBySongId(score.game, songRes.newSongID);

		const chart = charts.find((c) => c.chartID === score.chartID);
		const song = songRes?.doc;

		if (!user || !chart || !song) {
			log.error(
				`Score ${score.scoreID} refers to non-existent data: [user,chart,song] [${!!user} ${!!chart} ${!!song}]`,
			);
			throw new ExpectedErr(500, "An internal server error has occurred.");
		}

		return success("Returned score.", { chart, score, song, user });
	}

	return success("Returned score.", { score });
});

/**
 * Modifies a score.
 *
 * Requires you to be the owner of this score, and have the modify_scores permission.
 *
 * @name PATCH /api/v1/scores/:scoreID
 */
API_V1_ROUTER.add(
	"PATCH /scores/:scoreID",
	withScore,
	withScoreOwner,
	async ({ input, ctx, req }) => {
		const { scoreDoc: score } = ctx;

		const modifyOption: { comment?: string | null; highlight?: boolean } = {};

		if (input.comment !== undefined) {
			modifyOption.comment = input.comment;
		}

		if (input.highlight !== undefined) {
			modifyOption.highlight = input.highlight;
		}

		if (Object.keys(modifyOption).length === 0) {
			throw new ExpectedErr(400, "This request modifies nothing about the score.");
		}

		const auth = req[SYMBOL_TACHI_API_AUTH];

		if (auth.userID === null) {
			throw new ExpectedErr(401, "Authentication is required.");
		}

		const user = await GetUserWithID(auth.userID);

		if (!user) {
			throw new ExpectedErr(401, "Authentication is required.");
		}

		const taker = { acct: { id: user.id, username: user.username }, ip: req.ip };

		await ACTION_CustomiseScore(taker, {
			scoreID: score.scoreID,
			...modifyOption,
		});

		const updated = await LoadScoreDocumentById(score.scoreID);

		if (!updated) {
			throw new ExpectedErr(500, "Score disappeared after update.");
		}

		return success("Updated score.", updated);
	},
);

/**
 * Deletes the score.
 *
 * @param blacklist - Whether to blacklist this scoreID or not.
 * A blacklisted score will never be reimported.
 *
 * @name DELETE /api/v1/scores/:scoreID
 */
API_V1_ROUTER.add("DELETE /scores/:scoreID", async ({ input, params, req }) => {
	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID === null) {
		throw new ExpectedErr(401, "Authentication is required.");
	}

	const user = await GetUserWithID(auth.userID);

	if (!user) {
		throw new ExpectedErr(401, "Authentication is required.");
	}

	await ACTION_DeleteScore(
		{ acct: { id: user.id, username: user.username }, ip: req.ip },
		{ blacklist: input.blacklist, id: params.scoreID },
	);

	return success("Successfully deleted score.", {});
});
