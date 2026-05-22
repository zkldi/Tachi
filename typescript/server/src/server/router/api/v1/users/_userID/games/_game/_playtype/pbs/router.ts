import { GetChartByIdForGame, GetChartsBySongId } from "#lib/db-formats/chart";
import {
	GetPBOnChart,
	LoadPbDocumentsForUserPrimaryCharts,
	LoadPbDocumentsForUserPrimaryChartsSortedByAlg,
	LoadPbsByUserIdsAndChartPgId,
	LoadPbsForUserOnChartsByPgIds,
	LoadPbsForUserOnSongPgId,
} from "#lib/db-formats/pb";
import { GetSongByID } from "#lib/db-formats/song";
import { log } from "#lib/log/log";
import { GetRivalUsers } from "#lib/rivals/rivals";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { ResolveSongAndChart } from "#lib/score-import/import-types/common/batch-manual/converter";
import { SearchSpecificGameSongsAndCharts } from "#lib/search/song-charts";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetRelevantSongsAndCharts } from "#utils/db";
import { IsValidScoreAlg } from "#utils/misc";
import { GetAdjacentAbove, GetAdjacentBelow } from "#utils/queries/pbs";
import { FilterChartsAndSongs, GetScoreIDsFromComposed } from "#utils/scores";
import { GetUsersWithIDs } from "#utils/user";
import { ExpectedErr } from "bliss";
import {
	GameToGameGroup,
	LEGACY_GameToGameGroupPT,
	LEGACY_GetGamePTConfig,
	type MatchTypeResolver,
} from "tachi-common";

/**
 * Searches a user's personal bests.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;

		const { songs: allSongs, charts: allCharts } = await SearchSpecificGameSongsAndCharts(
			game,
			input.search,
		);

		const chartPgIds = [...new Set(allCharts.map((c) => c.chartID))];
		const pbs = await LoadPbsForUserOnChartsByPgIds(user.id, chartPgIds, { limit: 30 });

		const { songs, charts } = FilterChartsAndSongs(pbs, allCharts, allSongs);

		return success(`Retrieved ${pbs.length} personal bests.`, { charts, pbs, songs });
	},
);

/**
 * Returns all of a users personal bests.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs/all
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs/all",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const pbs = await LoadPbDocumentsForUserPrimaryCharts(user.id, game);
		const { songs, charts } = await GetRelevantSongsAndCharts(pbs);

		return success(`Returned ${pbs.length} PBs.`, { charts, pbs, songs });
	},
);

/**
 * Returns a users best 100 personal-bests for this game.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs/best
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs/best",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;
		const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);
		const gameConfig = LEGACY_GetGamePTConfig(gameGroup, playtype);

		if (input.alg !== undefined && !IsValidScoreAlg(gameConfig, input.alg)) {
			throw new ExpectedErr(
				400,
				`Invalid score algorithm. Expected any of ${Object.keys(gameConfig.scoreRatingAlgs).join(", ")}`,
			);
		}

		const alg = input.alg ?? gameConfig.defaultScoreRatingAlg;

		const pbs = await LoadPbDocumentsForUserPrimaryChartsSortedByAlg(user.id, game, alg, 100);
		const { songs, charts } = await GetRelevantSongsAndCharts(pbs);

		return success(`Retrieved ${pbs.length} personal bests.`, { charts, pbs, songs });
	},
);

/**
 * Use the tachi "resolve" engine to identify a chart and return the user's PB.
 *
 * @name POST /api/v1/users/:userID/games/:game/pbs/resolve
 */
API_V1_ROUTER.add(
	"POST /users/:userID/games/:game/pbs/resolve",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;
		const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);

		const safeBody = {
			...input,
			game: gameGroup,
			playtype,
		} as unknown as MatchTypeResolver;

		const got = await ResolveSongAndChart(safeBody, log);

		if (!got) {
			throw new ExpectedErr(
				404,
				`Could not resolve this chart with details: ${safeBody.matchType}:${safeBody.identifier}`,
			);
		}

		const pb = await GetPBOnChart(user.id, got.chart.chartID);

		if (!pb) {
			throw new ExpectedErr(404, "This user has not played this chart.");
		}

		return success("Successfully retrieved PB for user.", {
			chart: got.chart,
			pb,
			song: got.song,
		});
	},
);

/**
 * Returns all of a user's personal bests on every chart for a song.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs/song/:songID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs/song/:songID",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const songRow = await GetSongByID(GameToGameGroup(game), params.songID);
		if (!songRow) {
			throw new ExpectedErr(404, "This song does not exist.");
		}

		const chartsForSong = await GetChartsBySongId(game, params.songID);
		if (chartsForSong.length === 0) {
			throw new ExpectedErr(404, "This song does not exist for this game.");
		}

		const pbs = await LoadPbsForUserOnSongPgId(user.id, game, params.songID);
		const { songs, charts } = await GetRelevantSongsAndCharts(pbs);

		return success(`Retrieved ${pbs.length} personal bests for this song.`, {
			charts,
			pbs,
			songs,
		});
	},
);

/**
 * Returns a user's PB on the given chart.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs/:chartID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs/:chartID",
	withUserGameProfile,
	async ({ ctx, params, input }) => {
		const { requestedUser: user, game } = ctx;

		const chart = await GetChartByIdForGame(game, params.chartID);

		if (!chart) {
			throw new ExpectedErr(404, "This chart does not exist.");
		}

		const pb = await GetPBOnChart(user.id, chart.chartID);

		if (!pb) {
			throw new ExpectedErr(404, "This user has not played this chart.");
		}

		if (input.getComposition !== undefined) {
			const { LoadScoreDocumentById } = await import("#lib/db-formats/score");
			const scoreIDs = GetScoreIDsFromComposed(pb);
			const scores = (
				await Promise.all(scoreIDs.map((id) => LoadScoreDocumentById(id)))
			).filter((s): s is NonNullable<typeof s> => s !== undefined);

			return success("Successfully retrieved PB for user.", { chart, pb, scores });
		}

		return success("Successfully retrieved PB for user.", { chart, pb });
	},
);

/**
 * Returns a user's PB on the given chart, and all of their rivals performances.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs/:chartID/rivals
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs/:chartID/rivals",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const chart = await GetChartByIdForGame(game, params.chartID);

		if (!chart) {
			throw new ExpectedErr(404, "This chart does not exist.");
		}

		const rivals = await GetRivalUsers(user.id, game);
		const pbs = await LoadPbsByUserIdsAndChartPgId(
			rivals.map((e) => e.id),
			chart.chartID,
		);
		const usersPB = await GetPBOnChart(user.id, chart.chartID);

		if (usersPB) {
			pbs.push(usersPB);
		}

		return success("Retrieved PBs and Rival PBs.", { pbs, rivals });
	},
);

/**
 * Return this users PB on this chart, and 5 nearby players on the leaderboard.
 *
 * @name GET /api/v1/users/:userID/games/:game/pbs/:chartID/leaderboard-adjacent
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/pbs/:chartID/leaderboard-adjacent",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const chart = await GetChartByIdForGame(game, params.chartID);

		if (!chart) {
			throw new ExpectedErr(404, "This chart does not exist.");
		}

		const pb = await GetPBOnChart(user.id, chart.chartID);

		if (!pb) {
			throw new ExpectedErr(404, "This user has not played this chart.");
		}

		const [adjacentAbove, adjacentBelow] = await Promise.all([
			GetAdjacentAbove(pb),
			GetAdjacentBelow(pb),
		]);

		const users = await GetUsersWithIDs(
			[...adjacentAbove, ...adjacentBelow].map((e) => e.userID),
		);

		return success("Successfully retrieved PB for user.", {
			adjacentAbove,
			adjacentBelow,
			chart,
			pb,
			users,
		});
	},
);
