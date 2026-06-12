import { ONE_DAY } from "#lib/constants/time";
import { SELECT_PRIV_ACCOUNT_CREDENTIAL } from "#lib/db-formats/priv-account-credential";
import { SELECT_USER, ToUserDocument } from "#lib/db-formats/user";
import { SELECT_USER_SETTINGS, ToUserSettingsDocument } from "#lib/db-formats/user-settings";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type Kysely, sql, type Transaction } from "kysely";
import {
	type APITokenDocument,
	GetGameConfig,
	type integer,
	type ProfileRatingAlgorithms,
	UserAuthLevels,
	type UserDocument,
	type UserGameStats,
	type UserSettingsDocument,
	type V3Game,
} from "tachi-common";
import { type Database } from "tachi-db";

import { GetFollowingForUser } from "./queries/settings";

/**
 * Returns a user's username from their ID. Throws if no user with that ID exists.
 */
export async function GetUsernameFromUserID(userID: integer): Promise<string> {
	const username = await DB.selectFrom("account")
		.select("username")
		.where("id", "=", userID)
		.executeTakeFirst()
		.then((res) => res?.username);

	if (!username) {
		throw new Error(`Could not find username for userID ${userID}.`);
	}
	return username;
}

/**
 * Gets a user based on their username case-insensitively.
 */
export function GetUserCaseInsensitive(username: string): Promise<UserDocument | null> {
	return DB.selectFrom("account")
		.select(SELECT_USER)
		.where("normalized_username", "=", username.toLowerCase())
		.executeTakeFirst()
		.then((res) => (res ? ToUserDocument(res) : null));
}

export async function CheckIfEmailInUse(email: string) {
	const exists = await DB.selectFrom("priv_account_credential")
		.where("email", "=", email)
		.executeTakeFirst()
		.then((res) => !!res);

	return exists;
}

export function GetUserPrivateInfo(userID: integer) {
	return DB.selectFrom("priv_account_credential")
		.select(SELECT_PRIV_ACCOUNT_CREDENTIAL)
		.where("priv_account_credential.user_id", "=", userID)
		.executeTakeFirst();
}

/**
 * Gets a user from their userID.
 */
export function GetUserWithID(userID: integer): Promise<UserDocument | null> {
	return DB.selectFrom("account")
		.select(SELECT_USER)
		.where("id", "=", userID)
		.executeTakeFirst()
		.then((res) => (res ? ToUserDocument(res) : null));
}

export async function GetSettingsForUser(userID: integer): Promise<UserSettingsDocument> {
	const following = await GetFollowingForUser(userID);

	return DB.selectFrom("account_settings")
		.select(SELECT_USER_SETTINGS)
		.where("user_id", "=", userID)
		.executeTakeFirstOrThrow()
		.then((res) => ToUserSettingsDocument(following, res));
}

/**
 * Gets the users for these user IDs.
 */
export async function GetUsersWithIDs(userIDs: Array<integer>) {
	if (userIDs.length === 0) {
		return [];
	}

	const users = await DB.selectFrom("account")
		.select(SELECT_USER)
		.where("id", "in", userIDs)
		.execute()
		.then((rows) => rows.map(ToUserDocument));

	// Note that we should dedupe this by making a set
	// as passing [1, 1, 1] is perfectly legal to this function.
	if (users.length !== new Set(userIDs).size) {
		log.error(
			{ userIDs, users },
			`GetUsersWithIDs was given ${userIDs.length} userIDs, but only matched ${users.length} -- state desync likely.`,
		);
		throw new Error(
			`GetUsersWithIDs was given ${userIDs.length} userIDs, but only matched ${users.length}.`,
		);
	}

	return users;
}

/**
 * Retrieve a user document that is expected to exist.
 * If the user document is not found, a severe error is logged, and this
 * function throws.
 */
export async function GetUserWithIDGuaranteed(userID: integer): Promise<UserDocument> {
	const userDoc = await GetUserWithID(userID);

	if (!userDoc) {
		log.error(
			`User ${userID} does not have an associated user document, but one was expected.`,
		);
		throw new Error(
			`User ${userID} does not have an associated user document, but one was expected.`,
		);
	}

	return userDoc;
}

/**
 * Gets a user based on either their username case-insensitively, or a direct lookup of their ID.
 * This is used in URLs to resolve the passed user.
 */
export function ResolveUser(usernameOrID: string) {
	// user ID passed
	if (/^[0-9]+$/u.exec(usernameOrID)) {
		const intID = Number(usernameOrID);

		return GetUserWithID(intID);
	}

	return GetUserCaseInsensitive(usernameOrID);
}

/**
 * Returns a formatted string indicating the user. This is used for logging.
 */
export function FormatUserDoc(userdoc: UserDocument) {
	return `${userdoc.username} (#${userdoc.id})`;
}

export async function GetUsersRanking(stats: UserGameStats) {
	const { ranking } = await GetUsersRankingAndOutOf(stats);
	return ranking;
}

export function GetUserGamePlaycount(userID: integer, game: V3Game) {
	return DB.selectFrom("score")
		.select((eb) => eb.fn.countAll().as("playcount"))
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.executeTakeFirst()
		.then((res) => Number(res?.playcount ?? 0));
}

export async function GetAllRankings(stats: UserGameStats) {
	const gameConfig = GetGameConfig(stats.game);

	const entries = await Promise.all(
		Object.keys(gameConfig.profileRatingAlgs).map((k) =>
			GetUsersRankingAndOutOf(stats, k as ProfileRatingAlgorithms[V3Game]).then((r) => [
				k,
				r,
			]),
		),
	);

	return Object.fromEntries(entries) as Record<
		ProfileRatingAlgorithms[V3Game],
		{ outOf: integer; ranking: integer }
	>;
}

export async function GetUsersRankingAndOutOf(
	stats: UserGameStats,
	alg?: ProfileRatingAlgorithms[V3Game],
) {
	const gameConfig = GetGameConfig(stats.game);
	const ratingAlg = alg ?? gameConfig.defaultProfileRatingAlg;
	const userRating = stats.ratings[ratingAlg] ?? null;

	const result = await DB.selectFrom("game_profile")
		.select([
			(eb) => eb.fn.countAll().as("out_of"),
			sql<number>`COUNT(*) FILTER (
            WHERE user_id != ${stats.userID} -- itll include self when null, doesnt affect normal ranking
            AND (
                (ratings->>${ratingAlg})::numeric > ${userRating}::numeric
                OR ${userRating}::numeric IS NULL
            )
        )`.as("ranking_count"),
		])
		.where("game", "=", stats.game)
		.executeTakeFirstOrThrow();

	return {
		ranking: Number(result.ranking_count) + 1,
		outOf: Number(result.out_of),
	};
}

/**
 * 1-based leaderboard rank per user for a profile rating algorithm. Ties share the
 * same rank; the next rank skips (same as {@link GetUsersRankingAndOutOf}).
 */
export async function GetLeaderboardRanksForUserIds(
	game: V3Game,
	alg: ProfileRatingAlgorithms[V3Game],
	userIds: Array<integer>,
): Promise<ReadonlyMap<integer, integer>> {
	if (userIds.length === 0) {
		return new Map();
	}
	const uniqueIds = [...new Set(userIds)];

	const result = await sql<{ rank: string; user_id: number }>`
		WITH ranked AS (
			SELECT
				game_profile.user_id,
				RANK() OVER (
					ORDER BY coalesce((game_profile.ratings::jsonb->>${sql.lit(alg)})::numeric, 0) DESC
				) AS rank
			FROM game_profile
			WHERE game_profile.game = ${game}
		)
		SELECT user_id, rank
		FROM ranked
		WHERE user_id IN (${sql.join(uniqueIds.map((id) => sql`${id}`))})
	`.execute(DB);

	return new Map(result.rows.map((r) => [r.user_id, Number(r.rank)]));
}

const FIVE_MINUTES = 1000 * 60 * 5;

/**
 * Returns the cutoff point for "being online" in tachi. This means the user
 * has made any page request in the past 5 minutes.
 */
export function GetOnlineCutoff() {
	return Date.now() - FIVE_MINUTES;
}

/**
 * Returns whether a given userID is an administrator or not.
 */
export async function IsRequesterAdmin(request: APITokenDocument) {
	// API Tokens created on the behalf of an admin do NOT inherit admin permissions.
	if (request.token !== null) {
		return false;
	}

	if (request.userID === null) {
		return false;
	}

	const user = await GetUserWithIDGuaranteed(request.userID);

	return user.authLevel === UserAuthLevels.ADMIN;
}

export async function IsUserAdmin(userID: integer) {
	const exists = await DB.selectFrom("account")
		.select("auth_level")
		.where("id", "=", userID)
		.where("auth_level", "=", "admin")
		.executeTakeFirst()
		.then((res) => !!res);

	return exists;
}

export function IsUserBanned(userID: integer) {
	return DB.selectFrom("account")
		.select("auth_level")
		.where("id", "=", userID)
		.where("auth_level", "=", "banned")
		.executeTakeFirst()
		.then((res) => !!res);
}

/**
 * Return all the games this userID has played.
 */
export async function GetUserPlayedGames(userID: integer) {
	const rows = await DB.selectFrom("game_profile")
		.select("game")
		.where("user_id", "=", userID)
		.execute();

	return rows.map((r) => r.game);
}

export async function GetAllUserRivals(userID: integer) {
	const rows = await DB.selectFrom("game_rival")
		.select("rival")
		.where("user_id", "=", userID)
		.execute();

	return [...new Set(rows.map((r) => r.rival))];
}

const USERNAME_CHANGE_COOLDOWN = ONE_DAY * 180; // 6 months

export async function CanChangeUsername(
	txn: Kysely<Database> | Transaction<Database>,
	userID: integer,
) {
	const nextAvailableChange = await GetNextAvailableUsernameChange(txn, userID);

	return nextAvailableChange === null || nextAvailableChange < Date.now();
}

export async function GetNextAvailableUsernameChange(
	txn: Kysely<Database> | Transaction<Database>,
	userID: integer,
): Promise<integer | null> {
	const lastChange = await txn
		.selectFrom("account_username_change")
		.select("timestamp")
		.where("user_id", "=", userID)
		.orderBy("timestamp", "desc")
		.executeTakeFirst();

	if (!lastChange) {
		return null;
	}

	return ISO8601ToUnixMilliseconds(lastChange.timestamp) + USERNAME_CHANGE_COOLDOWN;
}

/**
 * Get the admin for the instance.
 *
 * This is used for things like builtin clients
 * and "default" admin actions. It would honestly be
 * clearer if there was a sort of "god" user on tachi
 * that was an admin but also just unique.
 *
 * In practice, that's how these things work anyway.
 */
export async function GetFirstAdmin(): Promise<UserDocument> {
	const admin = await DB.selectFrom("account")
		.select(SELECT_USER)
		.where("auth_level", "=", "admin")
		.orderBy("id", "asc")
		.executeTakeFirst();

	if (!admin) {
		throw new Error("There is no admin on this instance of Tachi.");
	}

	return ToUserDocument(admin);
}
