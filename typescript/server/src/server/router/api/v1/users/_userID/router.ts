import { ACTION_ChangeEmail } from "#actions/change-email";
import { ACTION_ChangePassword } from "#actions/change-password";
import { ACTION_ChangeUsername } from "#actions/change-username";
import { ACTION_UpdateUser } from "#actions/update-user";
import { GetRecentActivity } from "#lib/activity/activity";
import { ONE_MONTH } from "#lib/constants/time";
import { SELECT_GAME_PROFILE, ToGameStatsDocument } from "#lib/db-formats/game-profiles";
import { log } from "#lib/log/log";
import { GetRivalIDs } from "#lib/rivals/rivals";
import { withRequestedUser, withSelf } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import {
	GetGoalSummary,
	GetRecentlyViewedFoldersAnyGPT,
	GetRecentPlaycount,
	GetRecentSessions,
} from "#utils/queries/summary";
import {
	CanChangeUsername,
	FormatUserDoc,
	GetAllRankings,
	GetNextAvailableUsernameChange,
	GetSettingsForUser,
	GetUserWithIDGuaranteed,
} from "#utils/user";
import { ExpectedErr } from "bliss";
import {
	type AnyProfileRatingAlg,
	type integer,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

/**
 * Get the user at this ID or name.
 *
 * @name GET /api/v1/users/:userID
 */
API_V1_ROUTER.add("GET /users/:userID", withRequestedUser, ({ ctx }) =>
	success(`Found user ${ctx.requestedUser.username}.`, ctx.requestedUser),
);

/**
 * Modify this user document. All parameters are optional.
 *
 * @param about - An about me, this is rendered as markdown.
 * @param status - A user status. This is not rendered as markdown, and is short.
 * @param discord - The user's discord tag.
 * @param twitter - The user's twitter tag.
 * @param github - The user's github.
 * @param steam - The user's steamID.
 * @param youtube - The user's youtube.
 * @param twitch - The user's twitch.
 *
 * @name PATCH /api/v1/users/:userID
 */
API_V1_ROUTER.add(
	"PATCH /users/:userID",
	withRequestedUser,
	withSelf,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;

		await ACTION_UpdateUser(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{
				about: input.about,
				discord: input.discord,
				github: input.github,
				status: input.status,
				steam: input.steam,
				twitch: input.twitch,
				twitter: input.twitter,
				youtube: input.youtube,
			},
		);

		const newUser = await GetUserWithIDGuaranteed(user.id);

		if (req.session.tachi?.user) {
			req.session.tachi.user = newUser;
			req.session.save();
		}

		return success("Successfully updated user.", newUser);
	},
);

/**
 * Returns all per-game profiles (ratings, classes) for this user.
 * Additionally, adds a __rankingData property, which contains this users
 * ranking information.
 * This endpoint doubles up as a way of checking what games a user has played.
 *
 * @name GET /api/v1/users/:userID/game-profiles
 */
API_V1_ROUTER.add("GET /users/:userID/game-profiles", withRequestedUser, async ({ ctx }) => {
	const { requestedUser: user } = ctx;

	// a user has played a game if and only if they have stats for it.
	const stats: Array<
		{
			__rankingData?: Record<AnyProfileRatingAlg, { outOf: number; ranking: number }>;
		} & UserGameStats
	> = await DB.selectFrom("game_profile")
		.select(SELECT_GAME_PROFILE)
		.where("game_profile.user_id", "=", user.id)
		.execute()
		.then((rows) => rows.map(ToGameStatsDocument));

	await Promise.all(
		stats.map(async (s) => {
			s.__rankingData = await GetAllRankings(s);
		}),
	);

	return success(`Returned ${stats.length} stats objects.`, stats);
});

/**
 * Returns a summary of what the user has achieved in the past 16 hours.
 * Used on the main dashboard page to give users quick links to sessions,
 * alongside other information.
 *
 * @name GET /api/v1/users/:userID/recent-summary
 */
API_V1_ROUTER.add("GET /users/:userID/recent-summary", withRequestedUser, async ({ ctx }) => {
	const { requestedUser: user } = ctx;

	const [
		recentPlaycount,
		recentSessions,
		{ folders: recentFolders, stats: recentFolderStats },
		{ achievedGoals, goals, improvedGoals },
	] = await Promise.all([
		GetRecentPlaycount(user.id),
		GetRecentSessions(user.id),
		GetRecentlyViewedFoldersAnyGPT(user.id),
		GetGoalSummary(user.id),
	]);

	return success(`Retrieved information about ${FormatUserDoc(user)}.`, {
		recentAchievedGoals: achievedGoals,
		recentFolderStats,
		recentFolders,
		recentGoals: goals,
		recentImprovedGoals: improvedGoals,
		recentPlaycount,
		recentSessions,
	});
});

/**
 * Returns whether the user has verified their email or not.
 * Requires self-key level permissions.
 *
 * @name GET /api/v1/users/:userID/is-email-verified
 */
API_V1_ROUTER.add(
	"GET /users/:userID/is-email-verified",
	withRequestedUser,
	withSelf,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const verifyInfo = await DB.selectFrom("priv_verify_email_token")
			.where("priv_verify_email_token.user_id", "=", user.id)
			.executeTakeFirst();

		const verified = !verifyInfo;

		return success(
			verified ? "User has verified email." : "User has not verified email.",
			verified,
		);
	},
);

/**
 * Get what email this user signed up with.
 *
 * @name GET /api/v1/users/:userID/email
 */
API_V1_ROUTER.add("GET /users/:userID/email", withRequestedUser, withSelf, async ({ ctx }) => {
	const { requestedUser: user } = ctx;

	const row = await DB.selectFrom("priv_account_credential")
		.select("priv_account_credential.email")
		.where("priv_account_credential.user_id", "=", user.id)
		.executeTakeFirst();

	if (!row) {
		log.error(`User ${user.id} doesn't have private info?`);
		throw new ExpectedErr(500, "Internal Server Error.");
	}

	return success("User signed up with this email.", row.email);
});

/**
 * Change what email is associated with this account.
 *
 * @param !email - The new email address (validated).
 *
 * @name POST /api/v1/users/:userID/change-email
 */
API_V1_ROUTER.add(
	"POST /users/:userID/change-email",
	withRequestedUser,
	withSelf,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;

		await ACTION_ChangeEmail(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{ "!password": input["!password"], "!email": input["!email"] },
		);

		return success("Re-sent email verification to new email.", null);
	},
);

/**
 * Changes the users password.
 * Requires self-key level permissions.
 *
 * @param !password - The new password. Must pass password validation rules.
 * @param !oldPassword - The old password.
 *
 * @name POST /api/v1/users/:userID/change-password
 */
API_V1_ROUTER.add(
	"POST /users/:userID/change-password",
	withRequestedUser,
	withSelf,
	async ({ input, req }) => {
		const user = req.session.tachi?.user;

		/* istanbul ignore next */
		if (!user) {
			log.error(`IP ${req.ip} got to /change-password without a user.`);
			throw new ExpectedErr(403, "You are not authorised to perform this action.");
		}

		await ACTION_ChangePassword(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{ "!oldPassword": input["!oldPassword"], "!password": input["!password"] },
		);

		return success("Updated Password.", {});
	},
);

/**
 * Changes the users username.
 * Requires self-key level permissions.
 *
 * @param !password - The new password. Must pass password validation rules.
 * @param newUsername - The new username. Must pass username validation rules.
 *
 * @name POST /api/v1/users/:userID/change-username
 */
API_V1_ROUTER.add(
	"POST /users/:userID/change-username",
	withRequestedUser,
	withSelf,
	async ({ input, ctx, req }) => {
		const { requestedUser: user } = ctx;

		await ACTION_ChangeUsername(
			{ acct: { id: user.id, username: user.username }, ip: req.ip },
			{ "!password": input["!password"], newUsername: input.newUsername },
		);

		const newUser = await GetUserWithIDGuaranteed(user.id);

		if (req.session.tachi?.user) {
			req.session.tachi.user = newUser;
			req.session.save();
		}

		return success("Changed username.", newUser);
	},
);

/**
 * Get the last time the user changed their username,
 * and whether they can change their username again.
 *
 * @name GET /api/v1/users/:userID/last-username-change
 */
API_V1_ROUTER.add(
	"GET /users/:userID/last-username-change",
	withRequestedUser,
	withSelf,
	async ({ ctx }) => {
		const { requestedUser: user } = ctx;

		const canChange = await CanChangeUsername(DB, user.id);
		const nextChange = canChange ? null : await GetNextAvailableUsernameChange(DB, user.id);

		return success("Returned username change eligibility.", { canChange, nextChange });
	},
);

/**
 * Get the recent import types this user has used.
 *
 * @name GET /api/v1/users/:userID/recent-imports
 */
API_V1_ROUTER.add("GET /users/:userID/recent-imports", withRequestedUser, async ({ ctx }) => {
	const { requestedUser: user } = ctx;

	const oneMonthAgo = new Date(Date.now() - ONE_MONTH).toISOString();

	const rows = await DB.selectFrom("import")
		.select(["import.import_type as importType", DB.fn.count<number>("import.id").as("count")])
		.where("import.user_id", "=", user.id)
		.where("import.user_intent", "=", true)
		.where("import.time_finished", ">=", oneMonthAgo)
		.where("import.import_type", "not in", [
			"file/mypagescraper-records-csv",
			"file/mypagescraper-player-csv",
		])
		.groupBy("import.import_type")
		.orderBy("count", "desc")
		.execute();

	const body = rows.map((r) => ({
		importType: r.importType,
		count: Number(r.count),
	}));

	return success("Returned recent import types.", body);
});

/**
 * Get stats for this user on all games.
 *
 * @name GET /api/v1/users/:userID/stats
 */
API_V1_ROUTER.add("GET /users/:userID/stats", withRequestedUser, async ({ ctx }) => {
	const { requestedUser: user } = ctx;

	const [scoreCount, sessionCount] = await Promise.all([
		DB.selectFrom("score")
			.select(DB.fn.countAll().as("count"))
			.where("score.user_id", "=", user.id)
			.executeTakeFirstOrThrow()
			.then((r) => Number(r.count)),
		DB.selectFrom("session")
			.select(DB.fn.countAll().as("count"))
			.where("session.user_id", "=", user.id)
			.executeTakeFirstOrThrow()
			.then((r) => Number(r.count)),
	]);

	return success("Returned user stats.", {
		scores: scoreCount,
		sessions: sessionCount,
	});
});

/**
 * Fetch this users recent activity, and all of their rivals for each GPT they've played.
 *
 * @name GET /api/v1/users/:userID/activity
 */
API_V1_ROUTER.add("GET /users/:userID/activity", withRequestedUser, async ({ input, ctx }) => {
	const { requestedUser: user } = ctx;

	const startTime = input.startTime ?? null;
	const includeRivals = input.includeRivals === "true";
	const includeFollowers = input.includeFollowers === "true";

	const gameProfileRows = await DB.selectFrom("game_profile")
		.select(SELECT_GAME_PROFILE)
		.where("game_profile.user_id", "=", user.id)
		.execute();

	const gameStats = gameProfileRows.map(ToGameStatsDocument);
	const data: Partial<Record<V3Game, unknown>> = {};
	const settings = await GetSettingsForUser(user.id);

	await Promise.all(
		gameStats.map(async (e) => {
			const userIDs: Array<integer> = [user.id];

			if (includeRivals) {
				const rivalIDs = await GetRivalIDs(user.id, e.game);

				userIDs.push(...rivalIDs);
			}

			// n.b. it is intentional behaviour that you only get updates for
			// people you follow on games you play.
			if (includeFollowers) {
				userIDs.push(...settings.following);
			}

			const activity = await GetRecentActivity(
				e.game,
				{ userID: { $in: userIDs } },
				30,
				startTime,
			);

			data[e.game] = activity;
		}),
	);

	return success("Returned recent activity.", data);
});
