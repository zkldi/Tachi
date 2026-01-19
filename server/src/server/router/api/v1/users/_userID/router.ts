import apiTokensRouter from "./api-tokens/router";
import bannerRouter from "./banner/router";
import followingRouter from "./following/router";
import gameSpecificRouter from "./games/@gameSpecificRoutes/router";
import gamePTRouter from "./games/_game/_playtype/router";
import importsRouter from "./imports/router";
import integrationsRouter from "./integrations/router";
import invitesRouter from "./invites/router";
import { GetUserFromParam, RequireSelfRequestFromUser } from "./middleware";
import notifsRouter from "./notifications/router";
import pfpRouter from "./pfp/router";
import sessionsRouter from "./sessions/router";
import settingsRouter from "./settings/router";
import { HashPassword, PasswordCompare, ValidateEmail, ValidatePassword } from "../../auth/auth";
import { Router } from "express";
import db from "external/mongo/db";
import { GetRecentActivity } from "lib/activity/activity";
import { ONE_MONTH } from "lib/constants/time";
import { SendEmail } from "lib/email/client";
import { EmailFormatVerifyEmail } from "lib/email/formats";
import CreateLogCtx from "lib/logger/logger";
import { GetRivalIDs } from "lib/rivals/rivals";
import { ServerConfig } from "lib/setup/config";
import { p } from "prudence";
import prValidate from "server/middleware/prudence-validate";
import { DeleteUndefinedProps, IsNonEmptyString, Random20Hex, StripUrl } from "utils/misc";
import { optNullFluffStrField } from "utils/prudence";
import {
	GetGoalSummary,
	GetRecentPlaycount,
	GetRecentSessions,
	GetRecentlyViewedFoldersAnyGPT,
} from "utils/queries/summary";
import { GetUser } from "utils/req-tachi-data";
import {
	CanChangeUsername,
	CheckIfEmailInUse,
	FormatUserDoc,
	GetAllRankings,
	GetNextAvailableUsernameChange,
	GetUserCaseInsensitive,
	GetUserWithID,
} from "utils/user";
import type {
	AnyProfileRatingAlg,
	GPTString,
	ImportTypes,
	UserGameStats,
	integer,
} from "tachi-common";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

router.use(GetUserFromParam);

/**
 * Get the user at this ID or name.
 * @name GET /api/v1/users/:userID
 */
router.get("/", (req, res) => {
	const user = GetUser(req);

	return res.status(200).json({
		success: true,
		description: `Found user ${user.username}.`,
		body: user,
	});
});

interface UserPatchBody {
	about?: string | null;
	status?: string | null;
	discord?: string | null;
	twitter?: string | null;
	twitch?: string | null;
	youtube?: string | null;
	github?: string | null;
	steam?: string | null;
}

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
router.patch(
	"/",
	RequireSelfRequestFromUser,
	prValidate(
		{
			about: p.optional(p.isBoundedString(0, 2000)),
			status: optNullFluffStrField,
			discord: optNullFluffStrField,
			twitter: optNullFluffStrField,
			github: optNullFluffStrField,
			steam: optNullFluffStrField,
			youtube: optNullFluffStrField,
			twitch: optNullFluffStrField,
		},
		{
			about: "Your about me is too long.",
		}
	),
	async (req, res) => {
		const user = GetUser(req);

		const body = req.safeBody as UserPatchBody;

		if (Object.keys(body).length === 0) {
			return res.status(400).json({
				success: false,
				description: `Nothing was provided to modify.`,
			});
		}

		// Hack stuff for user experience.
		// In kt1, users would repeatedly mess up these fields.
		if (IsNonEmptyString(body.twitter)) {
			body.twitter = StripUrl("twitter.com/", body.twitter);
		}

		if (IsNonEmptyString(body.github)) {
			body.github = StripUrl("github.com/", body.github);
		}

		if (IsNonEmptyString(body.youtube)) {
			// youtube has THREE user urls lol
			body.youtube = StripUrl("youtube.com/user/", body.youtube);
			body.youtube = StripUrl("youtube.com/channel/", body.youtube);
			body.youtube = StripUrl("youtube.com/@", body.youtube);
		}

		if (IsNonEmptyString(body.twitch)) {
			body.twitch = StripUrl("twitch.tv/", body.twitch);
		}

		if (IsNonEmptyString(body.steam)) {
			body.steam = StripUrl("steamcommunity.com/id/", body.steam);
		}

		if (body.about === null) {
			return res.status(400).json({
				success: false,
				description: `Cannot set about me to null.`,
			});
		}

		// :(
		const modifyObject: Partial<
			Record<
				| "status"
				| `socialMedia.${
						| "discord"
						| "github"
						| "steam"
						| "twitch"
						| "twitter"
						| "youtube"}`,
				string | null
			> & { about: string }
		> = {
			about: body.about,
			status: body.status,
		};

		for (const socMed of [
			"twitch",
			"github",
			"youtube",
			"steam",
			"twitter",
			"discord",
		] as const) {
			modifyObject[`socialMedia.${socMed}` as const] = body[socMed];
		}

		DeleteUndefinedProps(modifyObject);

		await db.users.update(
			{
				id: user.id,
			},
			{
				$set: modifyObject,
			}
		);

		const newUser = await GetUserWithID(user.id);

		if (!newUser) {
			logger.severe(
				`User ${FormatUserDoc(user)} updated profile but user doc no longer exists?`,
				{ user }
			);

			return res.status(500).json({
				success: false,
				description: `An internal error has occured.`,
			});
		}

		if (req.session.tachi?.user) {
			req.session.tachi.user = newUser;
		}

		return res.status(200).json({
			success: true,
			description: `Successfully updated user.`,
			body: newUser,
		});
	}
);

/**
 * Returns all of the game-stats this user has.
 * Additionally, adds a __rankingData property, which contains this users
 * ranking information.
 * This endpoint doubles up as a way of checking what games a user has played.
 *
 * @name GET /api/v1/users/:userID/game-stats
 */
router.get("/game-stats", async (req, res) => {
	const user = GetUser(req);

	// a user has played a game if and only if they have stats for it.
	const stats: Array<
		UserGameStats & {
			__rankingData?: Record<AnyProfileRatingAlg, { outOf: number; ranking: number }>;
		}
	> = await db["game-stats"].find({ userID: user.id });

	await Promise.all(
		stats.map(async (s) => {
			const data = await GetAllRankings(s);

			// eslint-disable-next-line require-atomic-updates
			s.__rankingData = data;
		})
	);

	return res.status(200).json({
		success: true,
		description: `Returned ${stats.length} stats objects.`,
		body: stats,
	});
});

/**
 * Returns a summary of what the user has achieved in the past 16 hours.
 * Used on the main dashboard page to give users quick links to sessions,
 * alongside other information.
 *
 * @name GET /api/v1/users/:userID/recent-summary
 */
router.get("/recent-summary", async (req, res) => {
	const user = GetUser(req);

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

	return res.status(200).json({
		success: true,
		description: `Retrieved information about ${FormatUserDoc(user)}.`,
		body: {
			recentPlaycount,
			recentSessions,
			recentFolders,
			recentFolderStats,
			recentAchievedGoals: achievedGoals,
			recentGoals: goals,
			recentImprovedGoals: improvedGoals,
		},
	});
});

/**
 * Returns whether the user has verified their email or not.
 * Requires self-key level permissions.
 *
 * @name GET /api/v1/users/:userID/is-email-verified
 */
router.get("/is-email-verified", RequireSelfRequestFromUser, async (req, res) => {
	const user = GetUser(req);

	const verifyInfo = await db["verify-email-codes"].findOne({
		userID: user.id,
	});

	if (verifyInfo) {
		return res.status(200).json({
			success: true,
			description: `User has not verified email.`,
			body: false,
		});
	}

	return res.status(200).json({
		success: true,
		description: `User has verified email.`,
		body: true,
	});
});

/**
 * Get what email this user signed up with.
 *
 * @name GET /api/v1/users/:userID/email
 */
router.get("/email", RequireSelfRequestFromUser, async (req, res) => {
	const user = GetUser(req);

	const email = await db["user-private-information"].findOne({
		userID: user.id,
	});

	if (email) {
		return res.status(200).json({
			success: true,
			description: `User signed up with this email.`,
			body: email.email,
		});
	}

	logger.error(`User ${user.id} doesn't have private info?`);

	return res.status(500).json({
		success: false,
		description: `Internal Server Error`,
	});
});

/**
 * Change what email is associated with this account.
 *
 * @name GET /api/v1/users/:userID/email
 */
router.post(
	"/change-email",
	RequireSelfRequestFromUser,
	prValidate({
		email: ValidateEmail,
		"!password": ValidatePassword,
	}),
	async (req, res) => {
		const user = GetUser(req);

		const body = req.safeBody as {
			"!password": string;
			email: string;
		};

		const privateInfo = await db["user-private-information"].findOne({
			userID: user.id,
		});

		if (!privateInfo) {
			logger.error(`User ${user.id} has no associated private info?`);
			return res.status(500).json({
				success: false,
				description: `Internal server error.`,
			});
		}

		const isPasswordValid = await PasswordCompare(body["!password"], privateInfo.password);

		if (!isPasswordValid) {
			return res.status(403).json({
				success: false,
				description: `Invalid password.`,
			});
		}

		const existingEmail = await CheckIfEmailInUse(body.email);

		if (existingEmail) {
			logger.info(`User attempted to change to email that was already in use.`);
			return res.status(409).json({
				success: false,
				description: `This email is already in use.`,
			});
		}

		logger.info(`User ${user.id} changed email from ${privateInfo.email} to ${body.email}`);

		await db["user-private-information"].update(
			{
				userID: user.id,
			},
			{
				$set: {
					email: body.email,
				},
			}
		);

		if (ServerConfig.EMAIL_CONFIG) {
			const resetEmailCode = Random20Hex();

			// clear out the previous email code!
			await db["verify-email-codes"].remove({
				userID: user.id,
			});

			await db["verify-email-codes"].insert({
				code: resetEmailCode,
				userID: user.id,
				email: body.email,
			});

			const { text, html } = EmailFormatVerifyEmail(user.username, resetEmailCode);

			void SendEmail(body.email, "Email Verification", html, text);
		}

		return res.status(200).json({
			success: true,
			description: `Re-sent email verification to new email`,
			body: null,
		});
	}
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
router.post(
	"/change-password",
	RequireSelfRequestFromUser,
	prValidate({
		"!password": ValidatePassword,
		"!oldPassword": ValidatePassword,
	}),
	async (req, res) => {
		const body = req.safeBody as {
			"!password": string;
			"!oldPassword": string;
		};

		const user = req.session.tachi?.user;

		/* istanbul ignore next */
		if (!user) {
			logger.severe(
				`IP ${req.ip} got to /change-password without a user, but passed RequireSelfRequest?`
			);

			// this should be a 500, but lie to them.
			return res.status(403).json({
				success: false,
				description: `You are not authorised to perform this action.`,
			});
		}

		const privateInfo = await db["user-private-information"].findOne({
			userID: user.id,
		});

		/* istanbul ignore next */
		if (!privateInfo) {
			logger.severe(`User ${FormatUserDoc(user)} has no private information?`, { user });
			return res.status(500).json({
				success: false,
				description: `An internal server error has occured.`,
			});
		}

		const isLastPasswordValid = await PasswordCompare(
			body["!oldPassword"],
			privateInfo.password
		);

		if (!isLastPasswordValid) {
			return res.status(401).json({
				success: false,
				description: `Old Password doesn't match what we have in our records.`,
			});
		}

		const newPasswordHash = await HashPassword(body["!password"]);

		await db["user-private-information"].update(
			{
				userID: user.id,
			},
			{
				$set: {
					password: newPasswordHash,
				},
			}
		);

		return res.status(200).json({
			success: true,
			description: `Updated Password.`,
			body: {},
		});
	}
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
router.post(
	"/change-username",
	RequireSelfRequestFromUser,
	prValidate(
		{
			"!password": ValidatePassword,
			newUsername: p.regex(/^[a-zA-Z_-][a-zA-Z0-9_-]{2,20}$/u),
		},
		{
			newUsername:
				"Username must be between 3 and 20 characters long, can only contain alphanumeric characters and cannot start with a number.",
			"!password": "Invalid password.",
		}
	),
	async (req, res) => {
		const body = req.safeBody as {
			"!password": string;
			newUsername: string;
		};

		const user = req.session.tachi?.user;

		/* istanbul ignore next */
		if (!user) {
			logger.severe(
				`IP ${req.ip} got to /change-username without a user, but passed RequireSelfRequest?`
			);

			// this should be a 500, but lie to them.
			return res.status(403).json({
				success: false,
				description: `You are not authorised to perform this action.`,
			});
		}

		const privateInfo = await db["user-private-information"].findOne({
			userID: user.id,
		});

		/* istanbul ignore next */
		if (!privateInfo) {
			logger.severe(`User ${FormatUserDoc(user)} has no private information?`, { user });
			return res.status(500).json({
				success: false,
				description: `An internal server error has occured.`,
			});
		}

		const isPasswordValid = await PasswordCompare(body["!password"], privateInfo.password);

		if (!isPasswordValid) {
			return res.status(401).json({
				success: false,
				description: `Invalid password.`,
			});
		}

		const existingUser = await GetUserCaseInsensitive(body.newUsername);

		if (existingUser) {
			logger.verbose(`Invalid username ${body.newUsername}, already in use.`);
			return res.status(409).json({
				success: false,
				description: "This username is already in use.",
			});
		}

		const canChangeUsername = await CanChangeUsername(user.id);

		if (!canChangeUsername) {
			return res.status(403).json({
				success: false,
				description: "You can only change your username every 6 months.",
			});
		}

		await db.users.update(
			{
				id: user.id,
			},
			{
				$set: {
					username: body.newUsername,
					usernameLowercase: body.newUsername.toLowerCase(),
				},
			}
		);

		await db["user-name-changes"].insert({
			userID: user.id,
			username: body.newUsername,
			timestamp: Date.now(),
			previousUsername: user.username,
		});

		if (req.session.tachi?.user) {
			req.session.tachi.user = {
				...user,
				username: body.newUsername,
			};
			req.session.save();
		}

		return res.status(200).json({
			success: true,
			description: `Updated your username!`,
			body: {},
		});
	}
);

/**
 * Get the last time the user changed their username,
 * and whether they can change their username again.
 *
 * @name GET /api/v1/users/:userID/last-username-change
 */
router.get("/last-username-change", async (req, res) => {
	const user = GetUser(req);

	const nextAvailableChange = await GetNextAvailableUsernameChange(user.id);

	const canChange = await CanChangeUsername(user.id);

	let body;

	if (canChange) {
		body = {
			canChange: true,
		};
	} else {
		body = {
			canChange: false,
			nextAvailableChange,
		};
	}

	return res.status(200).json({
		success: true,
		description: `Next available username change.`,
		body,
	});
});
/**
 * Get the recent import types this user has used.
 *
 * @name GET /api/v1/users/:userID/recent-imports
 */
router.get("/recent-imports", async (req, res) => {
	const user = GetUser(req);

	const recentImports: Array<{ _id: ImportTypes; count: integer }> = await db.imports.aggregate([
		{
			$match: {
				userID: user.id,
				timeFinished: { $gt: Date.now() - ONE_MONTH },
				userIntent: true,
				importType: {
					$nin: ["file/mypagescraper-records-csv", "file/mypagescraper-player-csv"],
				},
			},
		},
		{
			$group: {
				_id: "$importType",
				count: { $sum: 1 },
			},
		},
	]);

	// rename _id to importType.
	const imports = recentImports.map((e) => ({ importType: e._id, count: e.count }));

	return res.status(200).json({
		success: true,
		description: `Found ${recentImports.length} imports.`,
		body: imports.sort((a, b) => b.count - a.count),
	});
});

/**
 * Get stats for this user on all games.
 *
 * @name GET /api/v1/users/:userID/stats
 */
router.get("/stats", async (req, res) => {
	const user = GetUser(req);

	const scoreCount = await db.scores.count({ userID: user.id });
	const sessionCount = await db.sessions.count({ userID: user.id });

	return res.status(200).json({
		success: true,
		description: `Retrieved stats.`,
		body: {
			scores: scoreCount,
			sessions: sessionCount,
		},
	});
});

/**
 * Fetch this users recent activity, and all of their rivals for each GPT they've played.
 *
 * @name GET /api/v1/users/:userID/activity
 */
router.get(
	"/activity",
	prValidate({
		startTime: "*string",
		includeRivals: p.optional(p.isIn("true", "false")),
		includeFollowers: p.optional(p.isIn("true", "false")),
	}),
	async (req, res) => {
		const qStartTime = req.query.startTime as string | undefined;

		const includeRivals = req.query.includeRivals === "true";
		const includeFollowers = req.query.includeFollowers === "true";

		const startTime = qStartTime ? Number(qStartTime) : null;

		if (Number.isNaN(startTime)) {
			return res.status(400).json({
				success: false,
				description: `Invalid startTime, got a non number.`,
			});
		}

		const user = GetUser(req);

		const gpts = await db["game-stats"].find({
			userID: user.id,
		});

		const data: Partial<Record<GPTString, unknown>> = {};

		const settings = await db["user-settings"].findOne({ userID: user.id });

		if (!settings) {
			logger.error(`User ${FormatUserDoc(user)} doesn't have any settings?`);
			return res.status(500).json({
				success: false,
				description: `This user has no settings.`,
			});
		}

		await Promise.all(
			gpts.map(async (e) => {
				const userIDs: Array<integer> = [user.id];

				if (includeRivals) {
					const rivalIDs = await GetRivalIDs(user.id, e.game, e.playtype);

					userIDs.push(...rivalIDs);
				}

				// n.b. it is intentional behaviour that you only get updates for
				// people you follow on games you play.
				if (includeFollowers) {
					userIDs.push(...settings.following);
				}

				const activity = await GetRecentActivity(
					e.game,
					{
						game: e.game,
						playtype: e.playtype,
						userID: { $in: userIDs },
					},
					30,
					startTime
				);

				data[`${e.game}:${e.playtype}` as GPTString] = activity;
			})
		);

		return res.status(200).json({
			success: true,
			description: `Returned recent activity.`,
			body: data,
		});
	}
);

router.use("/games", gameSpecificRouter);
router.use("/games/:game/:playtype", gamePTRouter);
router.use("/pfp", pfpRouter);

router.use("/banner", bannerRouter);
router.use("/integrations", integrationsRouter);
router.use("/settings", settingsRouter);
router.use("/api-tokens", apiTokensRouter);
router.use("/invites", invitesRouter);
router.use("/imports", importsRouter);
router.use("/notifications", notifsRouter);
router.use("/following", followingRouter);
router.use("/sessions", sessionsRouter);

// Shims for discord functionality; discord checks that a url ends with ".png"
// to use as an image
router.get("/pfp.png", (req, res) => {
	res.redirect("./pfp");
});
router.get("/banner.png", (req, res) => {
	res.redirect("./banner");
});

export default router;
