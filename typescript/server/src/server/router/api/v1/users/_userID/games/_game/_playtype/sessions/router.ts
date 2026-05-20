import {
	SELECT_SESSION_CALENDAR,
	SELECT_SESSION_DOCUMENT,
	ToSessionCalendarDocument,
	ToSessionDocument,
} from "#lib/db-formats/session";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { GetSessionScoreInfo } from "#lib/score-import/framework/sessions/sessions";
import { SearchSessions } from "#lib/search/search";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { GetScoreIdsGroupedBySessionId } from "#utils/queries/sessions";
import { CheckStrSessionAlg } from "#utils/string-checks";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";
import { type AnySessionRatingAlg, GetGameConfig, LEGACY_GameToGameGroupPT } from "tachi-common";
import { type Game } from "tachi-db";

/**
 * Search a users sessions.
 *
 * @name GET /api/v1/users/:userID/games/:game/sessions
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/sessions",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;
		const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);

		const hits = await SearchSessions(input.search, gameGroup, playtype, user.id, 100);

		return success(
			`Retrieved ${hits.length} sessions.`,
			hits.map(({ session, rank }) => ({ ...session, __textScore: rank })),
		);
	},
);

/**
 * Returns a user's best 100 sessions according to the default statistic for that game.
 *
 * @name GET /api/v1/users/:userID/games/:game/sessions/best
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/sessions/best",
	withUserGameProfile,
	async ({ ctx, input }) => {
		const { requestedUser: user, game } = ctx;
		const gameConfig = GetGameConfig(game);

		let alg = gameConfig.defaultSessionRatingAlg as AnySessionRatingAlg;

		if (typeof input.alg === "string") {
			const userAlg = CheckStrSessionAlg(game, input.alg);

			if (userAlg === null) {
				throw new ExpectedErr(
					400,
					`Invalid algorithm '${input.alg}' provided. Expected any of ${Object.keys(gameConfig.sessionRatingAlgs).join(", ")}.`,
				);
			}

			alg = userAlg;
		}

		const rows = await DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("user_id", "=", user.id)
			.where("game", "=", game)
			.orderBy(
				sql`(session.calculated_data::jsonb->>${sql.lit(alg)})::double precision desc nulls last`,
			)
			.orderBy("session.time_ended", "desc")
			.limit(100)
			.execute();

		const scoreMap = await GetScoreIdsGroupedBySessionId(rows.map((r) => r.id));
		const sessions = rows.map((row) => ToSessionDocument(row, scoreMap.get(row.id) ?? []));

		sessions.sort(
			(a, b) => (b.calculatedData[alg] ?? -Infinity) - (a.calculatedData[alg] ?? -Infinity),
		);

		return success(`Retrieved ${sessions.length} sessions.`, sessions);
	},
);

/**
 * Returns a users 100 most recent highlighted sessions.
 *
 * @name GET /api/v1/users/:userID/games/:game/sessions/highlighted
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/sessions/highlighted",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const rows = await DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("user_id", "=", user.id)
			.where("game", "=", game)
			.where("highlight", "=", true)
			.orderBy("session.time_ended", "desc")
			.limit(100)
			.execute();

		const scoreMap = await GetScoreIdsGroupedBySessionId(rows.map((r) => r.id));
		const sessions = rows.map((row) => ToSessionDocument(row, scoreMap.get(row.id) ?? []));

		sessions.sort((a, b) => b.timeEnded - a.timeEnded);

		return success(`Returned ${sessions.length} sessions.`, sessions);
	},
);

/**
 * Returns a users 100 most recent sessions.
 *
 * @name GET /api/v1/users/:userID/games/:game/sessions/recent
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/sessions/recent",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;
		const v3Game = game as Game;

		const rows = await DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("user_id", "=", user.id)
			.where("game", "=", v3Game)
			.orderBy("session.time_ended", "desc")
			.limit(100)
			.execute();

		const scoreMap = await GetScoreIdsGroupedBySessionId(rows.map((r) => r.id));
		const sessions = rows.map((row) => ToSessionDocument(row, scoreMap.get(row.id) ?? []));

		sessions.sort((a, b) => b.timeEnded - a.timeEnded);

		return success(`Returned ${sessions.length} sessions.`, sessions);
	},
);

/**
 * Returns a user's most recent session.
 *
 * @name GET /api/v1/users/:userID/games/:game/sessions/last
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/sessions/last",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;
		const v3Game = game as Game;

		const row = await DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("user_id", "=", user.id)
			.where("game", "=", v3Game)
			.orderBy("session.time_ended", "desc")
			.executeTakeFirst();

		if (!row) {
			throw new ExpectedErr(404, "This user has not got any sessions!");
		}

		const scoreMap = await GetScoreIdsGroupedBySessionId([row.id]);
		const session = ToSessionDocument(row, scoreMap.get(row.id) ?? []);
		const scoreInfo = await GetSessionScoreInfo(session);

		return success("Returned a session.", { scoreInfo, session });
	},
);

/**
 * Returns all sessions with unnecessary properties removed for calendar display.
 *
 * @name GET /api/v1/users/:userID/games/:game/sessions/calendar
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/sessions/calendar",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;
		const v3Game = game as Game;

		const rows = await DB.selectFrom("session")
			.select(SELECT_SESSION_CALENDAR)
			.where("user_id", "=", user.id)
			.where("game", "=", v3Game)
			.execute();

		return success(`Found ${rows.length} events.`, rows.map(ToSessionCalendarDocument));
	},
);
