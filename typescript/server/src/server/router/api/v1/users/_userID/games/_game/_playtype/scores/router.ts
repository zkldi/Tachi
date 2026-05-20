import { GetChartByIdForGame } from "#lib/db-formats/chart";
import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { SearchSpecificGameSongsAndCharts } from "#lib/search/song-charts";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { GetRelevantSongsAndCharts } from "#utils/db";
import {
	GetPrimaryScoresForUserUGPT,
	GetRecentUGPTScoresByTimeAchieved,
	GetScoresForUserOnChartIDs,
} from "#utils/queries/scores";
import { FilterChartsAndSongs } from "#utils/scores";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";

/**
 * Searches a user's individual scores.
 *
 * @name GET /api/v1/users/:userID/games/:game/scores
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/scores",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;

		const { songs: allSongs, charts: allCharts } = await SearchSpecificGameSongsAndCharts(
			game,
			input.search,
		);

		const chartIDs = [...new Set(allCharts.map((c) => c.chartID))];
		const scores = await GetScoresForUserOnChartIDs(user.id, game, chartIDs, 30);

		const { songs, charts } = FilterChartsAndSongs(scores, allCharts, allSongs);

		return success(`Retrieved ${scores.length} scores.`, { charts, scores, songs });
	},
);

/**
 * Retrieve all scores from this user (expensive).
 *
 * @name GET /api/v1/users/:userID/games/:game/scores/all
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/scores/all",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const scores = await GetPrimaryScoresForUserUGPT(user.id, game);
		const { songs, charts } = await GetRelevantSongsAndCharts(scores);

		return success(`Returned ${scores.length} PBs.`, { charts, scores, songs });
	},
);

/**
 * Returns a users recent 100 scores for this game.
 *
 * @name GET /api/v1/users/:userID/games/:game/scores/recent
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/scores/recent",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const recentScores = await GetRecentUGPTScoresByTimeAchieved(user.id, game, 100);
		const { songs, charts } = await GetRelevantSongsAndCharts(recentScores);

		return success(`Retrieved ${recentScores.length} scores.`, {
			charts,
			scores: recentScores,
			songs,
		});
	},
);

/**
 * Retrieve all the scores a user has on the given chartID.
 *
 * @name GET /api/v1/users/:userID/games/:game/scores/:chartID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/scores/:chartID",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const chart = await GetChartByIdForGame(game, params.chartID);

		if (!chart) {
			throw new ExpectedErr(404, "This chart does not exist.");
		}

		const rows = await DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.leftJoin("import", "import.id", "score.import_id")
			.select(SELECT_SCORE_DOCUMENT)
			.where("score.user_id", "=", user.id)
			.where("chart.id", "=", chart.chartID)
			.orderBy(sql`score.time_achieved desc nulls last`)
			.execute();

		return success(
			`Returned ${rows.length} scores.`,
			rows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow)),
		);
	},
);
