import { ACTION_SetRivals } from "#actions/set-rivals";
import { GetRecentActivity } from "#lib/activity/activity";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { LoadPbDocumentsForUserSetSortedByCalculatedAlg } from "#lib/db-formats/pb";
import { GetChallengerUsers, GetRivalIDs, GetRivalUsers } from "#lib/rivals/rivals";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetRelevantSongsAndCharts } from "#utils/db";
import { DedupeArr, IsString } from "#utils/misc";
import { CheckStrScoreAlg } from "#utils/string-checks";
import { GetUsersWithIDs, GetUserWithIDGuaranteed } from "#utils/user";
import { ExpectedErr } from "bliss";
import { GetGameConfig } from "tachi-common";

/**
 * Returns all of this user's set rivals.
 *
 * @name GET /api/v1/users/:userID/games/:game/rivals
 */
API_V1_ROUTER.add("GET /users/:userID/games/:game/rivals", withUserGameProfile, async ({ ctx }) => {
	const { requestedUser: user, game } = ctx;

	const rivals = await GetRivalUsers(user.id, game);

	return success(`Returned ${rivals.length} rivals.`, rivals);
});

/**
 * Sets the user's rivals for this GPT.
 *
 * @name PUT /api/v1/users/:userID/games/:game/rivals
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/games/:game/rivals",
	withUserGameProfile,
	async ({ ctx, input, req }) => {
		const { requestedUser: user, game } = ctx;

		const authUserID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (authUserID === null) {
			throw new ExpectedErr(401, "Authentication is required for this endpoint.");
		}

		const authedUser = await GetUserWithIDGuaranteed(authUserID);
		const taker = { acct: { id: authedUser.id, username: authedUser.username }, ip: req.ip };

		const rivalIDs = input.rivalIDs;

		await ACTION_SetRivals(taker, { game, rivalIDs, userID: user.id });

		return success(`Set ${rivalIDs.length} rivals.`, {});
	},
);

/**
 * Return all of the users that are rivalling this user for this GPT.
 *
 * @name GET /api/v1/users/:userID/games/:game/rivals/challengers
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/rivals/challengers",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const challengers = await GetChallengerUsers(user.id, game);

		return success(`Returned ${challengers.length} challengers.`, challengers);
	},
);

/**
 * Retrieve a "PB leaderboard" for this user's set of rivals.
 *
 * @name GET /api/v1/users/:userID/games/:game/rivals/pb-leaderboard
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/rivals/pb-leaderboard",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;
		const gameConfig = GetGameConfig(game);

		let alg = gameConfig.defaultScoreRatingAlg;

		if (IsString(input.alg)) {
			const temp = CheckStrScoreAlg(game, input.alg);

			if (temp === null) {
				throw new ExpectedErr(
					400,
					`Invalid value of ${input.alg} for alg. Expected one of ${Object.keys(gameConfig.scoreRatingAlgs).join(", ")}`,
				);
			}

			alg = temp;
		}

		const rivalIDs = await GetRivalIDs(user.id, game);
		const userSet = [...rivalIDs, user.id];

		const pbs = await LoadPbDocumentsForUserSetSortedByCalculatedAlg(userSet, game, alg, 100);
		const users = await GetUsersWithIDs(pbs.map((e) => e.userID));
		const { songs, charts } = await GetRelevantSongsAndCharts(pbs);

		return success(`Successfully returned ${pbs.length} pbs.`, { charts, pbs, songs, users });
	},
);

/**
 * Retrieve activity for this user and their rivals on this GPT (same user set as the PB leaderboard).
 *
 * @name GET /api/v1/users/:userID/games/:game/rivals/activity
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/rivals/activity",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;

		const rivalIDs = await GetRivalIDs(user.id, game);
		const userIDs = DedupeArr([user.id, ...rivalIDs]);

		const data = await GetRecentActivity(
			game,
			{ userID: { $in: userIDs } },
			input.sessions ?? 30,
			input.startTime ?? null,
		);

		return success("Retrieved activity.", data);
	},
);
