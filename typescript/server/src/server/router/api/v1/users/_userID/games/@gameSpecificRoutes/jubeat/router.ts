import { GetPBsForJubility } from "#game-implementations/games/jubeat";
import { withGame, withRequestedUserAndReqData } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetRelevantSongsAndCharts } from "#utils/db";
import { REQ_GetUser } from "#utils/req-tachi-data";
import { ExpectedErr } from "bliss";
import { GameToGameGroup } from "tachi-common";

/**
 * Retrieve the PBs that went into this users jubility ranking.
 *
 * @name GET /api/v1/users/:userID/games/:game/jubility
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/jubility",
	withRequestedUserAndReqData,
	withGame,
	async ({ req, ctx }) => {
		if (GameToGameGroup(ctx.game) !== "jubeat") {
			throw new ExpectedErr(404, `No jubility data exists for ${ctx.game}.`);
		}

		const user = REQ_GetUser(req);

		const { bestHotScores, bestScores } = await GetPBsForJubility(user.id);
		const { songs, charts } = await GetRelevantSongsAndCharts([
			...bestHotScores,
			...bestScores,
		]);

		return success(`Retrieved scores that went into this users jubility.`, {
			songs,
			charts,
			pickUp: bestHotScores,
			other: bestScores,
		});
	},
);
