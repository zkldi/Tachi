import { GetRecentActivity } from "#lib/activity/activity";
import { PasswordCompare, ValidatePassword } from "#lib/auth/auth";
import { ONE_MONTH, ONE_WEEK, ONE_YEAR } from "#lib/constants/time";
import { GetChartsByIds } from "#lib/db-formats/chart";
import { SELECT_GAME_PROFILE, ToGameStatsDocument } from "#lib/db-formats/game-profiles";
import {
	type PbDocumentJoinRow,
	SELECT_PB_DOCUMENT_WITH_LEADERBOARD,
	ToPbScoreDocument,
} from "#lib/db-formats/pb";
import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { GetSongsByIDs } from "#lib/db-formats/song";
import { log } from "#lib/log/log";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { IsString } from "#utils/misc";
import DestroyUserGameProfile from "#utils/reset-state/destroy-user-game-profile";
import { CheckStrProfileAlg } from "#utils/string-checks";
import { ISO8601ToUnixMilliseconds, UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatUserDoc,
	GetAllRankings,
	GetLeaderboardRanksForUserIds,
	GetUGPTPlaycount,
	GetUserPrivateInfo,
	GetUsersRankingAndOutOf,
	GetUsersWithIDs,
} from "#utils/user";
import { ExpectedErr } from "bliss";
import { sql, type SqlBool } from "kysely";
import {
	GetGameConfig,
	type integer,
	LEGACY_FormatGameGroupPT,
	LEGACY_GameToGameGroupPT,
	type PBScoreDocument,
	type UserGameStats,
	type UserGameStatsSnapshotDocument,
	type UserGameStatsWithProfileLeaderboardRank,
} from "tachi-common";

/**
 * Returns information about a user for this game + playtype.
 *
 * @name GET /api/v1/users/:userID/games/:game
 */
API_V1_ROUTER.add("GET /users/:userID/games/:game", withUserGameProfile, async ({ ctx }) => {
	const { requestedUser: user, game, userGameStats: stats } = ctx;
	const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);

	const scoreJoin = () =>
		DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.leftJoin("import", "import.id", "score.import_id")
			.where("score.user_id", "=", user.id)
			.where("score.game", "=", game)
			.where("score.time_achieved", "is not", null);

	const [totalScores, firstRow, recentRow, rankingData, playtimeRow] = await Promise.all([
		DB.selectFrom("score")
			.select((eb) => eb.fn.countAll().as("c"))
			.where("user_id", "=", user.id)
			.where("game", "=", game)
			.executeTakeFirst()
			.then((r) => Number(r?.c ?? 0)),
		scoreJoin()
			.select(SELECT_SCORE_DOCUMENT)
			.orderBy("score.time_achieved", "asc")
			.executeTakeFirst(),
		scoreJoin()
			.select(SELECT_SCORE_DOCUMENT)
			.orderBy("score.time_achieved", "desc")
			.executeTakeFirst(),
		GetAllRankings(stats),
		DB.selectFrom("session")
			.select(
				sql<number>`coalesce(sum(extract(epoch from (session.time_ended::timestamptz - session.time_started::timestamptz)) * 1000), 0)::double precision`.as(
					"playtime",
				),
			)
			.where("user_id", "=", user.id)
			.where("game", "=", game)
			.executeTakeFirst(),
	]);

	const firstScore = firstRow ? ToScoreDocument(firstRow as ScoreDocumentJoinRow) : null;
	const mostRecentScore = recentRow ? ToScoreDocument(recentRow as ScoreDocumentJoinRow) : null;

	return success(`Retrieved user statistics for ${user.username} (${gameGroup} ${playtype})`, {
		firstScore,
		gameStats: stats,
		mostRecentScore,
		playtime: Math.round(Number(playtimeRow?.playtime ?? 0)),
		rankingData,
		totalScores,
	});
});

/**
 * Returns a users game-stats for the past 90 days.
 *
 * @name GET /api/v1/users/:userID/games/:game/history
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/history",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { game, requestedUser: user, userGameStats: stats } = ctx;
		const duration = input.duration;

		let time: number | null = Date.now();

		switch (duration) {
			case "year": {
				time -= ONE_YEAR;
				break;
			}
			case "3mo":
			case undefined: {
				time -= ONE_MONTH * 3;
				break;
			}
			case "month": {
				time -= ONE_MONTH;
				break;
			}
			case "week": {
				time -= ONE_WEEK;
				break;
			}
			case "all": {
				time = null;
				break;
			}
		}

		const snapshotRows = await DB.selectFrom("game_stats_snapshot")
			.select([
				"game_stats_snapshot.timestamp",
				"game_stats_snapshot.playcount",
				"game_stats_snapshot.ratings",
				"game_stats_snapshot.classes",
				"game_stats_snapshot.rankings",
			])
			.where("game_stats_snapshot.user_id", "=", user.id)
			.where("game_stats_snapshot.game", "=", game)
			.$if(time !== null, (qb) =>
				qb.where("game_stats_snapshot.timestamp", ">=", UnixMillisecondsToISO8601(time!)),
			)
			.orderBy("game_stats_snapshot.timestamp", "desc")
			.execute();

		const snapshots = snapshotRows.map(
			(row) =>
				({
					classes: row.classes,
					playcount: row.playcount,
					rankings: row.rankings,
					ratings: row.ratings,
					timestamp: ISO8601ToUnixMilliseconds(row.timestamp),
				}) as Omit<UserGameStatsSnapshotDocument, "game" | "playtype" | "userID">,
		);

		const currentSnapshot: Omit<UserGameStatsSnapshotDocument, "game" | "playtype" | "userID"> =
			{
				classes: stats.classes,
				playcount: await GetUGPTPlaycount(user.id, game),
				rankings: await GetAllRankings(stats),
				ratings: stats.ratings,
				timestamp: Date.now(),
			};

		return success(`Successfully returned history for the past ${snapshots.length} days.`, [
			currentSnapshot,
			...snapshots,
		]);
	},
);

/**
 * Returns the users most played charts by playcount.
 *
 * @name GET /api/v1/users/:userID/games/:game/most-played
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/most-played",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const mostPlayed = await DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.select([
				"chart.id as chart_id",
				"song.id as song_id",
				sql<number>`count(*)::int`.as("playcount"),
			])
			.where("score.user_id", "=", user.id)
			.where("score.game", "=", game)
			.groupBy(["chart.id", "song.id"])
			.orderBy("playcount", "desc")
			.limit(100)
			.execute();

		const chartIDs = mostPlayed.map((e) => e.chart_id);
		const songIDs = mostPlayed.map((e) => e.song_id);

		const [songs, charts, pbRows] = await Promise.all([
			GetSongsByIDs(songIDs),
			GetChartsByIds(chartIDs),
			chartIDs.length === 0
				? Promise.resolve([] as Array<PbDocumentJoinRow>)
				: DB.selectFrom("pb")
						.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
						.innerJoin("chart", "chart.id", "pb.chart_id")
						.innerJoin("song", "song.id", "chart.song_id")
						.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
						.where("pb.user_id", "=", user.id)
						.where("chart.id", "in", chartIDs)
						.execute()
						.then((rows) => rows as Array<PbDocumentJoinRow>),
		]);

		const playcountMap = new Map<string, integer>();

		for (const doc of mostPlayed) {
			playcountMap.set(doc.chart_id, doc.playcount);
		}

		const playcountPBs = (await Promise.all(
			pbRows.map((row) => ToPbScoreDocument(row)),
		)) as Array<{ __playcount: integer } & PBScoreDocument>;

		for (const pb of playcountPBs) {
			pb.__playcount = playcountMap.get(pb.chartID) ?? 0;
		}

		playcountPBs.sort((a, b) => b.__playcount - a.__playcount);

		return success(`Returned ${playcountPBs.length} scores.`, {
			charts,
			pbs: playcountPBs,
			songs,
		});
	},
);

/**
 * Returns the users around the given user on the leaderboard.
 *
 * @name GET /api/v1/users/:userID/games/:game/leaderboard-adjacent
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/leaderboard-adjacent",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game, userGameStats: thisUsersStats } = ctx;
		const gameConfig = GetGameConfig(game);

		let alg = gameConfig.defaultProfileRatingAlg;

		if (IsString(input.alg)) {
			const temp = CheckStrProfileAlg(game, input.alg);

			if (temp === null) {
				throw new ExpectedErr(
					400,
					`Invalid value of ${input.alg} for alg. Expected one of ${Object.keys(gameConfig.profileRatingAlgs).join(", ")}`,
				);
			}

			alg = temp;
		}

		const userRating = thisUsersStats.ratings[alg] ?? 0;
		const ratingCol = sql<number>`coalesce((game_profile.ratings::jsonb->>${sql.lit(alg)})::numeric, 0)`;

		const [aboveRows, belowRows] = await Promise.all([
			DB.selectFrom("game_profile")
				.select(SELECT_GAME_PROFILE)
				.where("game", "=", game)
				.where("user_id", "<>", user.id)
				.where(sql<SqlBool>`${ratingCol} > ${userRating}`)
				.orderBy(ratingCol, "asc")
				.limit(5)
				.execute(),
			DB.selectFrom("game_profile")
				.select(SELECT_GAME_PROFILE)
				.where("game", "=", game)
				.where("user_id", "<>", user.id)
				.where(sql<SqlBool>`${ratingCol} <= ${userRating}`)
				.orderBy(ratingCol, "desc")
				.limit(5)
				.execute(),
		]);

		const above = aboveRows.map(ToGameStatsDocument);
		const below = belowRows.map(ToGameStatsDocument);

		const users = await GetUsersWithIDs([
			...aboveRows.map((e) => e.user_id),
			...belowRows.map((e) => e.user_id),
		]);

		const thisUsersRanking = await GetUsersRankingAndOutOf(thisUsersStats, alg);

		const rankByUser = await GetLeaderboardRanksForUserIds(game, alg, [
			user.id,
			...aboveRows.map((r) => r.user_id),
			...belowRows.map((r) => r.user_id),
		]);

		const withRank = (s: UserGameStats): UserGameStatsWithProfileLeaderboardRank => ({
			...s,
			rank: rankByUser.get(s.userID)!,
		});

		return success(`Returned ${above.length + below.length} nearby stats.`, {
			above: above.reverse().map(withRank),
			below: below.map(withRank),
			thisUsersRanking,
			thisUsersStats: withRank(thisUsersStats),
			users,
		});
	},
);

/**
 * Retrieve activity for this user.
 *
 * @name GET /api/v1/users/:userID/games/:game/activity
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/activity",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;

		const data = await GetRecentActivity(
			game,
			{ userID: user.id },
			input.sessions ?? 30,
			input.startTime ?? null,
		);

		return success("Retrieved activity.", data);
	},
);

/**
 * Completely wipe this profile. Requires the user's password.
 *
 * @name DELETE /api/v1/users/:userID/games/:game
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/games/:game",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { game: v3Game, requestedUser: user } = ctx;
		const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(v3Game);

		log.info(
			`Recieved request to delete UGPT ${FormatUserDoc(user)} ${LEGACY_FormatGameGroupPT(gameGroup, playtype)}`,
		);

		const privateInfo = await GetUserPrivateInfo(user.id);

		if (!privateInfo) {
			log.error({ user }, `State desync for user ${FormatUserDoc(user)}.`);
			throw new ExpectedErr(500, "An internal server error has occured.");
		}

		const password = input["!password"] as string;
		const isValidPassword = ValidatePassword(password);

		if (isValidPassword !== true) {
			throw new ExpectedErr(400, "Invalid password format.");
		}

		const passwordMatch = await PasswordCompare(password, privateInfo.password);

		if (!passwordMatch) {
			throw new ExpectedErr(403, "Invalid password.");
		}

		await DestroyUserGameProfile(user.id, v3Game);

		return success("Destroyed profile.", {});
	},
);
