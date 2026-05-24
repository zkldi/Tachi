import type { GetRecentActivity } from "#lib/activity/activity";
import type { ActionRow } from "#lib/admin/admin-queries";
import type { SessionCalendarDocument } from "#lib/db-formats/session";
import type { GetEnumDistForFolder } from "#lib/folders/folders";
import type { AnyRouterSpec } from "#lib/router/typed-router";
import type { TachiServerConfig } from "#lib/setup/config";
import type { EvaluateUsersStatsShowcase } from "#lib/showcase/get-stats";
import type { GitCommit } from "#utils/git";
import type { CronTask, CronTaskExecution, JobQueue } from "tachi-db";

import {
	ALL_GAMES,
	type APITokenDocument,
	type CGCardInfo,
	type ChartDocument,
	type FervidexSettingsDocument,
	type FolderDocument,
	type GameConfig,
	type GameGroupConfig,
	type GoalDocument,
	type GoalSubscriptionDocument,
	type ImportDocument,
	type ImportTrackerDocument,
	type integer,
	type InviteCodeDocument,
	type KaiAuthDocument,
	type KsHookSettingsDocument,
	type MytCardInfo,
	type NotificationDocument,
	type PBScoreDocument,
	type QuestDocument,
	type QuestlineDocument,
	type QuestSubscriptionDocument,
	type RecentlyViewedFolderDocument,
	type ScoreDocument,
	type SessionDocument,
	type SessionScoreInfo,
	type SongDocument,
	type TableDocument,
	type TachiAPIClientDocument,
	type UGPTSettingsDocument,
	type UserDocument,
	type UserGameStats,
	type UserGameStatsSnapshotDocument,
	type UserGameStatsWithProfileLeaderboardRank,
	type UserSettingsDocument,
} from "tachi-common";
import { z } from "zod";

type TachiInstanceConfig = TachiServerConfig["TACHI_CONFIG"];
type ActivityPayload = Awaited<ReturnType<typeof GetRecentActivity>>;
type FolderEnumStatRow = Awaited<ReturnType<typeof GetEnumDistForFolder>>;
type ShowcaseEvalRow = Awaited<ReturnType<typeof EvaluateUsersStatsShowcase>>[number];
type UserGameStatsWithRanking = {
	__rankingData?: Record<string, { outOf: integer; ranking: integer }>;
} & UserGameStats;
type SearchUserRow = { __isRival: boolean } & UserDocument;
type SearchChartsByGame = Record<
	string,
	Array<{
		chart: ChartDocument;
		playcount: integer;
		song: SongDocument;
	}>
>;
type UserRankingPosition = { outOf: integer; ranking: integer };
type UGPTHistorySnapshot = Omit<UserGameStatsSnapshotDocument, "game" | "playtype" | "userID">;
type AdminJobQueueFilters = { job_kind?: string; scope?: string; status?: number };
type AdminActionFilters = { kind?: string; username?: string };

// ─── Output schema helpers ────────────────────────────────────────────────────
// Opaque MongoDB document - validates the value is a record but does not
// constrain individual fields. Pass `T` so `z.infer` and handler output types
// match the API document type (runtime validation stays shallow).
function doc<T = Record<string, unknown>>(): z.ZodType<T> {
	return z.record(z.string(), z.unknown()) as z.ZodType<T>;
}

function docArray<T = Record<string, unknown>>(): z.ZodType<T[]> {
	return z.array(z.record(z.string(), z.unknown())) as z.ZodType<T[]>;
}

// Empty success body - mutation endpoints that carry no return payload.
const empty = z.object({});

export const API_V1_SPEC = {
	// ────────────────────────────────────────────────
	// Status
	// ────────────────────────────────────────────────

	"GET /status": {
		description: "Server status, version, auth identity, and optional echo.",
		input: z.object({ echo: z.string().optional() }),
		output: z.strictObject({
			serverTime: z.number(),
			startTime: z.number(),
			version: z.string(),
			whoami: z.number().nullable(),
			permissions: z.array(z.string()),
			echo: z.string().optional(),
		}),
	},

	"POST /status": {
		description: "Same as GET /status but via POST for clients that cannot send query params.",
		input: z.object({ echo: z.string().optional() }),
		output: z.strictObject({
			serverTime: z.number(),
			startTime: z.number(),
			version: z.string(),
			whoami: z.number().nullable(),
			permissions: z.array(z.string()),
			echo: z.string().optional(),
		}),
	},

	// ────────────────────────────────────────────────
	// Auth
	// ────────────────────────────────────────────────

	"POST /auth/login": {
		description: "Session login with username + password.",
		input: z.object({
			username: z.string(),
			"!password": z.string(),
			captcha: z.string().optional(),
		}),
		output: z.strictObject({ userID: z.number() }),
	},

	"POST /auth/register": {
		description: "Register a new account.",
		input: z.object({
			username: z.string(),
			"!password": z.string(),
			"!email": z.email(),
			inviteCode: z.string().optional(),
			captcha: z.string().optional(),
		}),
		output: doc<UserDocument>(),
	},

	"POST /auth/verify-email": {
		description: "Verify email address with a code.",
		input: z.object({ code: z.string() }),
		output: empty,
	},

	"POST /auth/resend-verify-email": {
		description: "Resend email verification code.",
		input: z.object({}),
		output: empty,
	},

	"POST /auth/logout": {
		description: "Destroy the current session.",
		input: z.object({}),
		output: empty,
	},

	"POST /auth/forgot-password": {
		description: "Request a password reset email.",
		input: z.object({ "!email": z.email() }),
		output: empty,
	},

	"POST /auth/reset-password": {
		description: "Reset password using a one-time code.",
		input: z.object({ code: z.string(), "!password": z.string() }),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Config
	// ────────────────────────────────────────────────

	"GET /config": {
		description: "Returns this instance's TachiConfig.",
		input: z.object({}),
		output: doc<TachiInstanceConfig>(),
	},

	"GET /config/beatoraja-queue-size": {
		description: "Returns the beatoraja import queue size (Bokutachi only).",
		input: z.object({}),
		output: z.number(),
	},

	"GET /config/max-rivals": {
		description: "Returns the maximum number of rivals a user may have.",
		input: z.object({}),
		output: z.number(),
	},

	// ────────────────────────────────────────────────
	// Activity (global)
	// ────────────────────────────────────────────────

	"GET /activity": {
		description: "Global recent activity across all games.",
		input: z.object({ startTime: z.coerce.number().optional() }),
		output: z.record(z.string(), doc<ActivityPayload>()),
	},

	"GET /ublock-blocks-this": {
		description:
			"Global recent activity across all games (alias of GET /activity for clients affected by blocklists that match `/activity`).",
		input: z.object({ startTime: z.coerce.number().optional() }),
		output: z.record(z.string(), doc<ActivityPayload>()),
	},

	// ────────────────────────────────────────────────
	// Search
	// ────────────────────────────────────────────────

	"GET /search": {
		description: "Search users, charts, and folders.",
		input: z.object({ search: z.string() }),
		output: z.strictObject({
			charts: z.record(
				z.string(),
				z.array(
					z.strictObject({
						chart: doc<ChartDocument>(),
						playcount: z.number(),
						song: doc<SongDocument>(),
					}),
				),
			) as z.ZodType<SearchChartsByGame>,
			folders: docArray<FolderDocument>(),
			users: docArray<SearchUserRow>(),
		}),
	},

	"GET /search/chart-hash": {
		description: "Search charts by hash.",
		input: z.object({ search: z.string() }),
		output: z.strictObject({ charts: docArray<ChartDocument>() }),
	},

	// ────────────────────────────────────────────────
	// Users (top-level)
	// ────────────────────────────────────────────────

	"GET /users": {
		description: "List users, optionally filtered by search query or online status.",
		input: z.object({
			search: z.string().optional(),
			online: z.string().optional(),
		}),
		output: docArray<UserDocument>(),
	},

	// ────────────────────────────────────────────────
	// Users /:userID
	// ────────────────────────────────────────────────

	"GET /users/:userID": {
		description: "Retrieve the public profile of a user.",
		input: z.object({}),
		output: doc<UserDocument>(),
	},

	"PATCH /users/:userID": {
		description: "Update the authenticated user's public profile fields.",
		input: z.object({
			about: z.string().optional(),
			status: z.string().nullable().optional(),
			discord: z.string().nullable().optional(),
			twitter: z.string().nullable().optional(),
			github: z.string().nullable().optional(),
			steam: z.string().nullable().optional(),
			youtube: z.string().nullable().optional(),
			twitch: z.string().nullable().optional(),
		}),
		output: doc<UserDocument>(),
	},

	"GET /users/:userID/game-profiles": {
		description: "All per-game profiles (ratings, classes) and rankings for a user.",
		input: z.object({}),
		output: docArray<UserGameStatsWithRanking>(),
	},

	"GET /users/:userID/recent-summary": {
		description: "Dashboard summary of recent activity for a user.",
		input: z.object({}),
		output: z.strictObject({
			recentPlaycount: z.number(),
			recentSessions: docArray<SessionDocument>(),
			recentFolders: docArray<FolderDocument>(),
			recentFolderStats: docArray<FolderEnumStatRow>(),
			recentAchievedGoals: docArray<GoalSubscriptionDocument>(),
			recentImprovedGoals: docArray<GoalSubscriptionDocument>(),
			recentGoals: docArray<GoalDocument>(),
		}),
	},

	"GET /users/:userID/is-email-verified": {
		description: "Whether the authenticated user's email is verified (self only).",
		input: z.object({}),
		output: z.boolean(),
	},

	"GET /users/:userID/email": {
		description: "The authenticated user's email address (self only).",
		input: z.object({}),
		output: z.string(),
	},

	"POST /users/:userID/change-email": {
		description: "Change the authenticated user's email address.",
		input: z.object({ "!email": z.email(), "!password": z.string() }),
		output: z.null(),
	},

	"POST /users/:userID/change-password": {
		description: "Change the authenticated user's password.",
		input: z.object({ "!password": z.string(), "!oldPassword": z.string() }),
		output: empty,
	},

	"POST /users/:userID/change-username": {
		description: "Change the authenticated user's username.",
		input: z.object({ newUsername: z.string(), "!password": z.string() }),
		output: doc<UserDocument>(),
	},

	"GET /users/:userID/last-username-change": {
		description: "Date of last username change, to enforce change rate-limiting.",
		input: z.object({}),
		output: z.strictObject({
			canChange: z.boolean(),
			nextChange: z.number().nullable(),
		}),
	},

	"GET /users/:userID/recent-imports": {
		description: "Recent import types used by the user.",
		input: z.object({}),
		output: z.array(
			z.strictObject({
				importType: z.string(),
				count: z.number(),
			}),
		),
	},

	"GET /users/:userID/stats": {
		description: "Total score and session counts for the user.",
		input: z.object({}),
		output: z.strictObject({
			scores: z.number(),
			sessions: z.number(),
		}),
	},

	"GET /users/:userID/activity": {
		description: "Per-GPT activity feed for the user.",
		input: z.object({
			startTime: z.coerce.number().optional(),
			includeRivals: z.string().optional(),
			includeFollowers: z.string().optional(),
		}),
		output: z.record(z.string(), doc<ActivityPayload>()),
	},

	// ────────────────────────────────────────────────
	// Users /:userID/pfp and /banner
	// (PUT variants handled by separate Express+Multer routes)
	// ────────────────────────────────────────────────

	"GET /users/:userID/pfp": {
		description: "Redirect to the user's profile picture in the CDN.",
		input: z.object({}),
		output: empty,
	},

	"DELETE /users/:userID/pfp": {
		description: "Remove the authenticated user's profile picture.",
		input: z.object({}),
		output: empty,
	},

	"GET /users/:userID/banner": {
		description: "Redirect to the user's banner image in the CDN.",
		input: z.object({}),
		output: empty,
	},

	"DELETE /users/:userID/banner": {
		description: "Remove the authenticated user's banner image.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/settings
	// ────────────────────────────────────────────────

	"GET /users/:userID/settings": {
		description: "Public account settings for the user.",
		input: z.object({}),
		output: doc<UserSettingsDocument>(),
	},

	"PATCH /users/:userID/settings": {
		description: "Update the authenticated user's account settings.",
		input: z.object({
			invisible: z.boolean().optional(),
			developerMode: z.boolean().optional(),
			contentiousContent: z.boolean().optional(),
			advancedMode: z.boolean().optional(),
			deletableScores: z.boolean().optional(),
		}),
		output: doc<UserSettingsDocument>(),
	},

	// ────────────────────────────────────────────────
	// Users /:userID/api-tokens
	// ────────────────────────────────────────────────

	"GET /users/:userID/api-tokens": {
		description: "List all API tokens belonging to the authenticated user.",
		input: z.object({}),
		output: docArray<APITokenDocument>(),
	},

	"POST /users/:userID/api-tokens/create": {
		description: "Create a new API token.",
		input: z.object({
			clientID: z.string().optional(),
			identifier: z.string().optional(),
			permissions: z.array(z.string()).optional(),
		}),
		output: doc<APITokenDocument>(),
	},

	"DELETE /users/:userID/api-tokens/:token": {
		description: "Delete a specific API token.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/invites
	// ────────────────────────────────────────────────

	"GET /users/:userID/invites": {
		description: "List invite codes belonging to the authenticated user.",
		input: z.object({}),
		output: z.strictObject({
			invites: docArray<InviteCodeDocument>(),
			consumers: docArray<UserDocument>(),
		}),
	},

	"GET /users/:userID/invites/limit": {
		description: "The invite quota for the authenticated user.",
		input: z.object({}),
		output: z.strictObject({ invites: z.number(), limit: z.number() }),
	},

	"POST /users/:userID/invites/create": {
		description: "Create a new invite code.",
		input: z.object({}),
		output: doc<InviteCodeDocument>(),
	},

	// ────────────────────────────────────────────────
	// Users /:userID/following
	// ────────────────────────────────────────────────

	"GET /users/:userID/following": {
		description: "List users that this user is following.",
		input: z.object({}),
		output: z.strictObject({ friends: docArray<UserDocument>() }),
	},

	"POST /users/:userID/following/add": {
		description: "Follow a user.",
		input: z.object({ userID: z.number() }),
		output: empty,
	},

	"POST /users/:userID/following/remove": {
		description: "Unfollow a user.",
		input: z.object({ userID: z.number() }),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/notifications
	// ────────────────────────────────────────────────

	"GET /users/:userID/notifications": {
		description: "List notifications for the authenticated user.",
		input: z.object({}),
		output: docArray<NotificationDocument>(),
	},

	"POST /users/:userID/notifications/mark-all-read": {
		description: "Mark all notifications as read.",
		input: z.object({}),
		output: empty,
	},

	"POST /users/:userID/notifications/delete-all": {
		description: "Delete all notifications.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/sessions
	// ────────────────────────────────────────────────

	"GET /users/:userID/sessions/calendar": {
		description: "Lightweight session calendar data across all games.",
		input: z.object({}),
		output: docArray<SessionCalendarDocument>(),
	},

	// ────────────────────────────────────────────────
	// Users /:userID/imports
	// ────────────────────────────────────────────────

	"GET /users/:userID/imports": {
		description: "List recent imports for the user.",
		input: z.object({
			importType: z.string().optional(),
			userIntent: z.string().optional(),
		}),
		output: docArray<ImportDocument>(),
	},

	"GET /users/:userID/imports/failed": {
		description: "List failed import trackers for the user.",
		input: z.object({
			importType: z.string().optional(),
			userIntent: z.string().optional(),
		}),
		output: docArray<ImportTrackerDocument>(),
	},

	"GET /users/:userID/import-timestops": {
		description: "List API import timestop cursors for the authenticated user.",
		input: z.object({}),
		output: z.strictObject({
			timestops: z.array(
				z.strictObject({
					importType: z.string(),
					lastScoreTime: z.number().nullable(),
				}),
			),
		}),
	},

	"DELETE /users/:userID/import-timestops": {
		description: "Reset an API import timestop cursor.",
		input: z.object({ importType: z.string() }),
		output: empty,
	},

	"PUT /users/:userID/import-timestops": {
		description: "Set an API import timestop cursor to a specific timestamp.",
		input: z.object({
			importType: z.string(),
			lastScoreTime: z.number(),
		}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/integrations/myt (Kamaitachi only)
	// ────────────────────────────────────────────────

	"GET /users/:userID/integrations/myt": {
		description: "Get MYT card info for the user.",
		input: z.object({}),
		output: z.nullable(doc<MytCardInfo>()),
	},

	"PUT /users/:userID/integrations/myt": {
		description: "Set MYT card access code.",
		input: z.object({ cardAccessCode: z.string() }),
		output: empty,
	},

	"DELETE /users/:userID/integrations/myt": {
		description: "Clear MYT card access code.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/integrations/kai/:kaiType (Kamaitachi only)
	// ────────────────────────────────────────────────

	"GET /users/:userID/integrations/kai/:kaiType": {
		description: "Get Kai auth status for the given Kai service.",
		input: z.object({}),
		output: doc<KaiAuthDocument>(),
	},

	"DELETE /users/:userID/integrations/kai/:kaiType": {
		description: "Revoke Kai OAuth token for the given service.",
		input: z.object({}),
		output: empty,
	},

	"POST /users/:userID/integrations/kai/:kaiType/oauth2callback": {
		description: "Handle OAuth callback and store Kai token.",
		input: z.object({ code: z.string() }),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/integrations/cg/:cgType
	// ────────────────────────────────────────────────

	"GET /users/:userID/integrations/cg/:cgType": {
		description: "Get CG card info for the given CG type.",
		input: z.object({}),
		output: z.nullable(doc<CGCardInfo>()),
	},

	"PUT /users/:userID/integrations/cg/:cgType": {
		description: "Set CG card credentials.",
		input: z.object({ cardID: z.string(), pin: z.string() }),
		output: empty,
	},

	"DELETE /users/:userID/integrations/cg/:cgType": {
		description: "Clear CG card credentials.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Users /:userID/integrations/fervidex (Kamaitachi only)
	// ────────────────────────────────────────────────

	"GET /users/:userID/integrations/fervidex/settings": {
		description: "Get fervidex integration settings.",
		input: z.object({}),
		output: doc<FervidexSettingsDocument>(),
	},

	"PATCH /users/:userID/integrations/fervidex/settings": {
		description: "Update fervidex integration settings.",
		input: z.object({
			cards: z.array(z.string()).nullable().optional(),
			forceStaticImport: z.boolean().nullable().optional(),
		}),
		output: doc<FervidexSettingsDocument>(),
	},

	// ────────────────────────────────────────────────
	// Users /:userID/integrations/kshook-sv6c (Kamaitachi only)
	// ────────────────────────────────────────────────

	"GET /users/:userID/integrations/kshook-sv6c/settings": {
		description: "Get kshook-sv6c integration settings.",
		input: z.object({}),
		output: z.nullable(doc<KsHookSettingsDocument>()),
	},

	"PATCH /users/:userID/integrations/kshook-sv6c/settings": {
		description: "Update kshook-sv6c integration settings.",
		input: z.object({ forceStaticImport: z.boolean().optional() }),
		output: doc<KsHookSettingsDocument>(),
	},

	// ────────────────────────────────────────────────
	// Users /:userID/games/:game (UGPT)
	// ────────────────────────────────────────────────

	// User games - literal gameGroup segments (game-specific)
	"GET /users/:userID/games/:game/custom-tables/:tableUrlName": {
		description:
			"HTML stub for a user-specific custom BMS table; things like their rivals, etc.",
		input: z.object({}),
		output: z.object({}),
	},

	"GET /users/:userID/games/:game/custom-tables/:tableUrlName/header.json": {
		description: "header.json for a user-specific custom BMS table.",
		input: z.object({}),
		output: z.object({}),
	},

	"GET /users/:userID/games/:game/custom-tables/:tableUrlName/body.json": {
		description: "body.json for a user-specific custom BMS table.",
		input: z.object({}),
		output: z.object({}),
	},

	"GET /users/:userID/games/:game/best-score/:checksum": {
		description: "User PB on a BMS chart identified by MD5 or SHA256 hash.",
		input: z.object({}),
		output: z.nullable(doc<PBScoreDocument>()),
	},

	"GET /users/:userID/games/:game/playlists/:playlistID": {
		description: "IIDX user-specific playlist - things like their rivals, etc..",
		input: z.object({}),
		output: z.unknown(),
	},

	"GET /users/:userID/games/:game/jubility": {
		description: "PBs contributing to this user's Jubility ranking.",
		input: z.object({}),
		output: z.strictObject({
			songs: docArray<SongDocument>(),
			charts: docArray<ChartDocument>(),
			pickUp: docArray<PBScoreDocument>(),
			other: docArray<PBScoreDocument>(),
		}),
	},

	"GET /users/:userID/games/:game": {
		description: "UGPT overview (game stats, rankings).",
		input: z.object({}),
		output: z.strictObject({
			gameStats: doc<UserGameStatsWithRanking>(),
			totalScores: z.number(),
			playtime: z.number(),
			rankingData: z.record(z.string(), doc<UserRankingPosition>()),
			firstScore: z.nullable(doc<ScoreDocument>()),
			mostRecentScore: z.nullable(doc<ScoreDocument>()),
		}),
	},

	"GET /users/:userID/games/:game/history": {
		description: "Stats snapshots over time.",
		input: z.object({
			duration: z.enum(["week", "month", "3mo", "year", "all"]).optional(),
		}),
		output: docArray<UGPTHistorySnapshot>(),
	},

	"GET /users/:userID/games/:game/most-played": {
		description: "Most played charts for the user on this GPT.",
		input: z.object({}),
		output: z.strictObject({
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
			pbs: docArray<PBScoreDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/leaderboard-adjacent": {
		description: "Nearby players on the profile leaderboard.",
		input: z.object({ alg: z.string().optional() }),
		output: z.strictObject({
			thisUsersStats: doc<UserGameStatsWithProfileLeaderboardRank>(),
			thisUsersRanking: doc<UserRankingPosition>(),
			above: docArray<UserGameStatsWithProfileLeaderboardRank>(),
			below: docArray<UserGameStatsWithProfileLeaderboardRank>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/activity": {
		description: "Activity feed for this user+GPT.",
		input: z.object({
			sessions: z.coerce.number().min(10).max(100).optional(),
			startTime: z.coerce.number().optional(),
		}),
		output: doc<ActivityPayload>(),
	},

	"DELETE /users/:userID/games/:game": {
		description: "Delete all data for the user on this game+playtype.",
		input: z.object({ "!password": z.string() }),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// UGPT PBs
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/pbs": {
		description: "Search user PBs for the given game.",
		input: z.object({ search: z.string() }),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/pbs/all": {
		description: "All user PBs on primary charts (expensive).",
		input: z.object({}),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/pbs/best": {
		description: "Top 100 PBs sorted by algorithm.",
		input: z.object({ alg: z.string().optional() }),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"POST /users/:userID/games/:game/pbs/resolve": {
		description: "Resolve a chart using the tachi resolver engine and return the user's PB.",
		input: z.object({
			matchType: z.string(),
			identifier: z.string(),
			version: z.string().optional(),
			artist: z.string().optional(),
			difficulty: z.string().optional(),
		}),
		output: z.strictObject({
			chart: doc<ChartDocument>(),
			song: doc<SongDocument>(),
			pb: doc<PBScoreDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/pbs/song/:songID": {
		description: "All user PBs for every chart of the given song in this game.",
		input: z.object({}),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/pbs/:chartID": {
		description: "User's PB on a specific chart.",
		input: z.object({ getComposition: z.string().optional() }),
		output: z.strictObject({
			chart: doc<ChartDocument>(),
			pb: doc<PBScoreDocument>(),
			scores: docArray<ScoreDocument>().optional(),
		}),
	},

	"GET /users/:userID/games/:game/pbs/:chartID/rivals": {
		description: "User's PB on a chart plus all rival PBs.",
		input: z.object({}),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			rivals: docArray<UserDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/pbs/:chartID/leaderboard-adjacent": {
		description: "User's PB plus ~5 players above/below on the chart leaderboard.",
		input: z.object({}),
		output: z.strictObject({
			chart: doc<ChartDocument>(),
			pb: doc<PBScoreDocument>(),
			adjacentAbove: docArray<PBScoreDocument>(),
			adjacentBelow: docArray<PBScoreDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	// ────────────────────────────────────────────────
	// UGPT Scores
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/scores": {
		description: "Search user scores.",
		input: z.object({ search: z.string() }),
		output: z.strictObject({
			scores: docArray<ScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/scores/all": {
		description: "All user scores (expensive).",
		input: z.object({}),
		output: z.strictObject({
			scores: docArray<ScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/scores/recent": {
		description: "Most recent scores.",
		input: z.object({}),
		output: z.strictObject({
			scores: docArray<ScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/scores/:chartID": {
		description: "All user scores on a specific chart.",
		input: z.object({}),
		output: docArray<ScoreDocument>(),
	},

	// ────────────────────────────────────────────────
	// UGPT Sessions
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/sessions": {
		description: "Search user sessions.",
		input: z.object({ search: z.string() }),
		output: docArray<SessionDocument>(),
	},

	"GET /users/:userID/games/:game/sessions/best": {
		description: "Best sessions sorted by algorithm.",
		input: z.object({ alg: z.string().optional() }),
		output: docArray<SessionDocument>(),
	},

	"GET /users/:userID/games/:game/sessions/highlighted": {
		description: "Highlighted sessions.",
		input: z.object({}),
		output: docArray<SessionDocument>(),
	},

	"GET /users/:userID/games/:game/sessions/recent": {
		description: "Most recent sessions.",
		input: z.object({}),
		output: docArray<SessionDocument>(),
	},

	"GET /users/:userID/games/:game/sessions/last": {
		description: "Single most recent session.",
		input: z.object({}),
		output: z.strictObject({
			session: doc<SessionDocument>(),
			scoreInfo: docArray<SessionScoreInfo>(),
		}),
	},

	"GET /users/:userID/games/:game/sessions/calendar": {
		description: "Minimal session data for calendar display.",
		input: z.object({}),
		output: docArray<SessionCalendarDocument>(),
	},

	// ────────────────────────────────────────────────
	// UGPT Tables
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/tables/:tableID": {
		description: "User's enum-distribution stats across folders in a table.",
		input: z.object({}),
		output: z.strictObject({
			table: doc<TableDocument>(),
			folders: docArray<FolderDocument>(),
			stats: docArray<FolderEnumStatRow>(),
		}),
	},

	"GET /users/:userID/games/:game/tables/:tableID/evolution": {
		description:
			"Table evolution: strict per-chart enum milestones at or above each metric minimumRelevantValue; events sorted by play time.",
		input: z.object({}),
		output: z.strictObject({
			charts: docArray<ChartDocument>(),
			events: z.array(
				z.strictObject({
					chartID: z.string(),
					enumIndex: z.number(),
					metric: z.string(),
					scoreID: z.string(),
					timeAchieved: z.number().nullable(),
					timeAdded: z.number(),
					value: z.string(),
				}),
			),
			folderChartIDs: z.record(z.string(), z.array(z.string())),
			folders: docArray<FolderDocument>(),
			songs: docArray<SongDocument>(),
			table: doc<TableDocument>(),
		}),
	},

	// ────────────────────────────────────────────────
	// UGPT Showcase
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/showcase": {
		description: "Evaluate configured showcase stats for the user.",
		input: z.object({ projectUser: z.string().optional() }),
		output: docArray<ShowcaseEvalRow>(),
	},

	"GET /users/:userID/games/:game/showcase/custom": {
		description: "Evaluate a single custom folder or chart stat.",
		input: z.object({
			mode: z.enum(["folder", "chart"]),
			metric: z.string().optional(),
			folderSlug: z.string().optional(),
			gte: z.coerce.number().optional(),
			chartID: z.string().optional(),
		}),
		output: doc<ShowcaseEvalRow>(),
	},

	"PUT /users/:userID/games/:game/showcase": {
		description: "Replace the user's stat showcase configuration.",
		input: z.object({
			showcase: z.array(z.unknown()).max(6),
		}),
		output: z.nullable(doc<UGPTSettingsDocument>()),
	},

	// ────────────────────────────────────────────────
	// UGPT Settings
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/settings": {
		description: "Get this user's UGPT settings.",
		input: z.object({}),
		output: z.nullable(doc<UGPTSettingsDocument>()),
	},

	"PATCH /users/:userID/games/:game/settings": {
		description: "Patch UGPT settings preferences.",
		input: z.object({
			preferredScoreAlg: z.string().nullable().optional(),
			preferredSessionAlg: z.string().nullable().optional(),
			preferredProfileAlg: z.string().nullable().optional(),
			defaultTable: z.string().nullable().optional(),
			preferredRanking: z.string().nullable().optional(),
			gameSpecific: z.record(z.string(), z.unknown()).optional(),
			preferredDefaultEnum: z.string().nullable().optional(),
		}),
		output: doc<UGPTSettingsDocument>(),
	},

	// ────────────────────────────────────────────────
	// UGPT Folders
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/folders": {
		description: "Search folders with user stats.",
		input: z.object({
			search: z.string(),
			inactive: z.string().optional(),
		}),
		output: z.strictObject({
			folders: docArray<FolderDocument>(),
			stats: docArray<FolderEnumStatRow>(),
		}),
	},

	"GET /users/:userID/games/:game/folders/recent": {
		description: "Recently viewed folders for the user.",
		input: z.object({}),
		output: z.strictObject({
			folders: docArray<FolderDocument>(),
			stats: docArray<FolderEnumStatRow>(),
			views: docArray<RecentlyViewedFolderDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/folders/:folderSlug": {
		description: "User's PBs on charts in a folder.",
		input: z.object({}),
		output: z.strictObject({
			folder: doc<FolderDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
			stats: z.unknown(),
			pbs: docArray<PBScoreDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/folders/:folderSlug/stats": {
		description: "Aggregated stats for the user on a folder.",
		input: z.object({}),
		output: doc<{ folder: FolderDocument; stats: FolderEnumStatRow }>(),
	},

	"POST /users/:userID/games/:game/folders/:folderSlug/viewed": {
		description: "Record that the user viewed this folder.",
		input: z.object({}),
		output: empty,
	},

	"GET /users/:userID/games/:game/folders/:folderSlug/timeline": {
		description: "Timeline of score improvements on folder charts by criteria.",
		input: z.object({
			criteriaType: z.string(),
			criteriaValue: z.string(),
		}),
		output: z.strictObject({
			charts: docArray<ChartDocument>(),
			folder: doc<FolderDocument>(),
			scores: docArray<ScoreDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/folders/:folderSlug/evolution": {
		description:
			"Folder evolution: strict per-chart enum milestones at or above each metric minimumRelevantValue; events sorted by play time.",
		input: z.object({}),
		output: z.strictObject({
			charts: docArray<ChartDocument>(),
			events: z.array(
				z.strictObject({
					chartID: z.string(),
					enumIndex: z.number(),
					metric: z.string(),
					scoreID: z.string(),
					timeAchieved: z.number().nullable(),
					timeAdded: z.number(),
					value: z.string(),
				}),
			),
			folder: doc<FolderDocument>(),
			folderChartIDs: z.record(z.string(), z.array(z.string())),
			folders: docArray<FolderDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	// ────────────────────────────────────────────────
	// UGPT Targets
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/targets/recently-achieved": {
		description: "Recently achieved goals and quests.",
		input: z.object({}),
		output: z.strictObject({
			goals: docArray<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
			user: doc<UserDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/targets/recently-raised": {
		description: "Recently interacted goals and quests.",
		input: z.object({}),
		output: z.strictObject({
			goals: docArray<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
			user: doc<UserDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/targets/on-chart/:chartID": {
		description: "Goals and quests related to a specific chart.",
		input: z.object({}),
		output: z.strictObject({
			goals: docArray<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/targets/on-folder/:folderSlug": {
		description: "Goals and quests related to a specific folder.",
		input: z.object({}),
		output: z.strictObject({
			folder: doc<FolderDocument>(),
			goals: docArray<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/targets/all-subs": {
		description: "All goal and quest subscriptions for the user on this GPT.",
		input: z.object({}),
		output: z.strictObject({
			goalSubs: docArray<GoalSubscriptionDocument>(),
			goals: docArray<GoalDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
		}),
	},

	// UGPT Goals
	"GET /users/:userID/games/:game/targets/goals": {
		description: "User's goal subscriptions with related quest info.",
		input: z.object({}),
		output: z.strictObject({
			goalSubs: docArray<GoalSubscriptionDocument>(),
			goals: docArray<GoalDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
		}),
	},

	"POST /users/:userID/games/:game/targets/goals/add-goal": {
		description: "Create or subscribe to a goal.",
		input: z.object({
			criteria: z.unknown(),
			charts: z.unknown(),
		}),
		output: z.strictObject({
			goal: doc<GoalDocument>(),
			goalSub: doc<GoalSubscriptionDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/targets/goals/:goalID": {
		description: "Goal subscription detail.",
		input: z.object({}),
		output: z.strictObject({
			goal: doc<GoalDocument>(),
			goalSub: doc<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			user: doc<UserDocument>(),
		}),
	},

	"PUT /users/:userID/games/:game/targets/goals/:goalID": {
		description: "Update a standalone goal subscription by replacing its definition.",
		input: z.object({
			criteria: z.unknown(),
			charts: z.unknown(),
		}),
		output: z.strictObject({
			changed: z.boolean(),
			goal: doc<GoalDocument>(),
			goalSub: doc<GoalSubscriptionDocument>(),
		}),
	},

	"DELETE /users/:userID/games/:game/targets/goals/:goalID": {
		description: "Unsubscribe from a goal.",
		input: z.object({}),
		output: empty,
	},

	// UGPT Quests
	"GET /users/:userID/games/:game/targets/quests": {
		description: "Subscribed quests for the user.",
		input: z.object({}),
		output: z.strictObject({
			questSubs: docArray<QuestSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			goals: docArray<GoalDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/targets/quests/:questID": {
		description: "Quest progress detail.",
		input: z.object({}),
		output: z.strictObject({
			quest: doc<QuestDocument>(),
			questSub: doc<QuestSubscriptionDocument>(),
			goals: docArray<GoalDocument>(),
			results: docArray<GoalSubscriptionDocument>(),
		}),
	},

	"PUT /users/:userID/games/:game/targets/quests/:questID": {
		description: "Subscribe to a quest.",
		input: z.object({}),
		output: z.strictObject({
			quest: doc<QuestDocument>(),
			questSub: doc<QuestSubscriptionDocument>(),
			goals: docArray<GoalDocument>(),
			goalResults: docArray<GoalSubscriptionDocument>(),
		}),
	},

	"DELETE /users/:userID/games/:game/targets/quests/:questID": {
		description: "Unsubscribe from a quest.",
		input: z.object({}),
		output: z.strictObject({ quest: doc<QuestDocument>() }),
	},

	// ────────────────────────────────────────────────
	// UGPT Rivals
	// ────────────────────────────────────────────────

	"GET /users/:userID/games/:game/rivals": {
		description: "List the user's rivals.",
		input: z.object({}),
		output: docArray<UserDocument>(),
	},

	"PUT /users/:userID/games/:game/rivals": {
		description: "Replace the user's rival list.",
		input: z.object({ rivalIDs: z.array(z.number()) }),
		output: empty,
	},

	"GET /users/:userID/games/:game/rivals/challengers": {
		description: "Users who have this user as a rival.",
		input: z.object({}),
		output: docArray<UserDocument>(),
	},

	"GET /users/:userID/games/:game/rivals/pb-leaderboard": {
		description: "PB leaderboard including the user and their rivals.",
		input: z.object({ alg: z.string().optional() }),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /users/:userID/games/:game/rivals/activity": {
		description: "Activity feed for rivals.",
		input: z.object({
			sessions: z.coerce.number().min(10).max(100).optional(),
			startTime: z.coerce.number().optional(),
		}),
		output: doc<ActivityPayload>(),
	},

	// ────────────────────────────────────────────────
	// OAuth
	// ────────────────────────────────────────────────

	"POST /oauth/token": {
		description: "Exchange an OAuth2 authorization code for an API token.",
		input: z.object({
			client_id: z.string(),
			client_secret: z.string(),
			grant_type: z.literal("authorization_code"),
			redirect_uri: z.string(),
			code: z.string(),
		}),
		output: z.strictObject({
			userID: z.number(),
			token: z.string(),
			identifier: z.string().nullable(),
			permissions: z.record(z.string(), z.boolean()),
			fromAPIClient: z.string().nullable(),
		}),
	},

	"POST /oauth/create-code": {
		description: "Create an OAuth2 authorization code (session auth required).",
		input: z.object({}),
		output: z.strictObject({
			code: z.string(),
			userID: z.number(),
			createdOn: z.number(),
		}),
	},

	// ────────────────────────────────────────────────
	// Games
	// ────────────────────────────────────────────────

	"GET /games": {
		description: "List all supported games and their configurations.",
		input: z.object({}),
		output: z.strictObject({
			configs: z.record(z.string(), doc<GameGroupConfig>()),
			supportedGames: z.array(z.string()),
		}),
	},

	"GET /games/:gameGroup": {
		description: "Configuration for a specific game group.",
		input: z.object({}),
		output: doc<GameGroupConfig>(),
	},

	"GET /games/:game": {
		description: "Info and counts for a specific game+playtype.",
		input: z.object({}),
		output: z.strictObject({
			chartCount: z.number(),
			playerCount: z.number(),
			scoreCount: z.number(),
			config: doc<GameConfig>(),
		}),
	},

	// Games - BMS / IIDX literal paths (game-specific)
	"GET /games/:game/custom-tables": {
		description: "List custom BMS tables available.",
		input: z.object({}),
		output: z.array(
			z.strictObject({
				description: z.string(),
				forSpecificUser: z.boolean(),
				symbol: z.string(),
				tableName: z.string(),
				urlName: z.string(),
			}),
		),
	},

	"GET /games/:game/custom-tables/:tableUrlName": {
		description: "HTML stub for a custom BMS table (bmstable meta).",
		input: z.object({}),
		output: z.object({}),
	},

	"GET /games/:game/custom-tables/:tableUrlName/header.json": {
		description: "header.json for a custom BMS table.",
		input: z.object({}),
		output: z.object({}),
	},

	"GET /games/:game/custom-tables/:tableUrlName/body.json": {
		description: "body.json for a custom BMS table.",
		input: z.object({}),
		output: z.object({}),
	},

	"GET /games/:game/sieglinde-charts": {
		description: "Charts with Sieglinde ratings for this BMS playtype.",
		input: z.object({}),
		output: z.strictObject({
			songs: docArray<SongDocument>(),
			charts: docArray<ChartDocument>(),
		}),
	},

	"GET /games/:game/playlists": {
		description: "List IIDX playlists available for SP or DP.",
		input: z.object({}),
		output: z.array(
			z.strictObject({
				description: z.string(),
				forSpecificUser: z.boolean().optional(),
				playlistName: z.string(),
				urlName: z.string(),
			}),
		),
	},

	"GET /games/:game/playlists/:playlistID": {
		description: "IIDX playlist data.",
		input: z.object({}),
		output: z.unknown(),
	},

	"GET /games/:game/leaderboard": {
		description: "Profile leaderboard for a GPT.",
		input: z.object({
			alg: z.string().optional(),
			limit: z.coerce.number().max(500).optional(),
		}),
		output: z.strictObject({
			gameStats: docArray<UserGameStatsWithProfileLeaderboardRank>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /games/:game/pb-leaderboard": {
		description: "PB-based leaderboard for a GPT.",
		input: z.object({
			alg: z.string().optional(),
			limit: z.coerce.number().max(50).optional(),
		}),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /games/:game/players": {
		description: "Search for players who have played this GPT.",
		input: z.object({ search: z.string() }),
		output: docArray<UserDocument>(),
	},

	"GET /games/:game/activity": {
		description: "Activity feed for a GPT.",
		input: z.object({
			sessions: z.coerce.number().min(10).max(100).optional(),
			startTime: z.coerce.number().optional(),
		}),
		output: z.record(z.string(), doc<ActivityPayload>()),
	},

	// Games Charts
	"GET /games/:game/charts": {
		description: "List or search charts for a GPT.",
		input: z.object({
			search: z.string().optional(),
			noIntelligentOmit: z.string().optional(),
			requesterHasPlayed: z.string().optional(),
		}),
		output: z.strictObject({
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	"POST /games/:game/charts/resolve": {
		description: "Resolve a chart using identifiers from an external source.",
		input: z.object({
			matchType: z.string(),
			identifier: z.string(),
			version: z.string().optional(),
			artist: z.string().optional(),
			difficulty: z.string().optional(),
		}),
		output: z.strictObject({
			chart: doc<ChartDocument>(),
			song: doc<SongDocument>(),
		}),
	},

	"GET /games/:game/charts/:chartID": {
		description: "Chart details plus its song.",
		input: z.object({}),
		output: z.strictObject({
			chart: doc<ChartDocument>(),
			song: doc<SongDocument>(),
		}),
	},

	"GET /games/:game/charts/:chartID/folders": {
		description: "Folders that contain a specific chart.",
		input: z.object({ inactive: z.string().optional() }),
		output: docArray<FolderDocument>(),
	},

	"GET /games/:game/charts/:chartID/pbs": {
		description: "Top PBs on a chart by ranking page.",
		input: z.object({ startRanking: z.coerce.number().optional() }),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /games/:game/charts/:chartID/pbs/search": {
		description: "Search PBs on a chart by username.",
		input: z.object({ search: z.string() }),
		output: z.strictObject({
			pbs: docArray<PBScoreDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	// Games Songs
	"GET /games/:game/songs/:songID": {
		description: "Song document and all its charts for a GPT.",
		input: z.object({}),
		output: z.strictObject({
			song: doc<SongDocument>(),
			charts: docArray<ChartDocument>(),
		}),
	},

	// Games Folders
	"GET /games/:game/folders": {
		description: "Search folders for a GPT.",
		input: z.object({
			search: z.string(),
			inactive: z.string().optional(),
		}),
		output: docArray<FolderDocument>(),
	},

	"GET /games/:game/folders/:folderSlug": {
		description: "Folder with its songs and charts.",
		input: z.object({}),
		output: z.strictObject({
			folder: doc<FolderDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
		}),
	},

	// Games Tables
	"GET /games/:game/tables": {
		description: "List tables for a GPT.",
		input: z.object({ showInactive: z.string().optional() }),
		output: docArray<TableDocument>(),
	},

	"GET /games/:game/tables/:tableID": {
		description: "Table document with folder list.",
		input: z.object({}),
		output: z.strictObject({
			table: doc<TableDocument>(),
			folders: docArray<FolderDocument>(),
		}),
	},

	// Games Targets
	"GET /games/:game/targets/recently-achieved": {
		description: "Recently achieved goals/quests across all users for this GPT.",
		input: z.object({}),
		output: z.strictObject({
			goals: docArray<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
		}),
	},

	"GET /games/:game/targets/recently-raised": {
		description: "Recently interacted goals/quests across all users for this GPT.",
		input: z.object({}),
		output: z.strictObject({
			goals: docArray<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			quests: docArray<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
		}),
	},

	"GET /games/:game/targets/goals/popular": {
		description: "Get the most popular goals for this GPT.",
		input: z.object({}),
		output: docArray<GoalDocument>(),
	},

	"POST /games/:game/targets/goals/format": {
		description: "Format a goal description from its charts/criteria.",
		input: z.object({
			charts: z.record(z.string(), z.unknown()),
			criteria: z.record(z.string(), z.unknown()),
		}),
		output: z.string(),
	},

	"GET /games/:game/targets/goals/:goalID": {
		description: "Retrieve information about this goal and who is subscribed to it.",
		input: z.object({}),
		output: z.strictObject({
			goal: doc<GoalDocument>(),
			goalSubs: docArray<GoalSubscriptionDocument>(),
			users: docArray<UserDocument>(),
			parentQuests: docArray<QuestDocument>(),
		}),
	},

	"GET /games/:game/targets/quests": {
		description: "Search quests for this GPT.",
		input: z.object({ search: z.string() }),
		output: z.strictObject({
			quests: docArray<QuestDocument>(),
			goals: docArray<GoalDocument>(),
		}),
	},

	"GET /games/:game/targets/quests/:questID": {
		description: "Retrieve information about this quest and who is subscribed to it.",
		input: z.object({}),
		output: z.strictObject({
			quest: doc<QuestDocument>(),
			questSubs: docArray<QuestSubscriptionDocument>(),
			users: docArray<UserDocument>(),
			goals: docArray<GoalDocument>(),
			parentQuestlines: docArray<QuestlineDocument>(),
		}),
	},

	"GET /games/:game/targets/questlines": {
		description: "Retrieve all questlines for this GPT.",
		input: z.object({}),
		output: z.strictObject({
			questlines: docArray<QuestlineDocument>(),
			standalone: docArray<QuestDocument>(),
			standaloneGoals: docArray<GoalDocument>(),
		}),
	},

	"GET /games/:game/targets/questlines/:questlineID": {
		description: "Retrieve a specific questline.",
		input: z.object({}),
		output: z.strictObject({
			questline: doc<QuestlineDocument>(),
			quests: docArray<QuestDocument>(),
			goals: docArray<GoalDocument>(),
		}),
	},

	// ────────────────────────────────────────────────
	// Scores
	// ────────────────────────────────────────────────

	"GET /scores/:scoreID": {
		description: "Retrieve a score document.",
		input: z.object({ getRelated: z.string().optional() }),
		output: z.strictObject({
			score: doc<ScoreDocument>(),
			chart: doc<ChartDocument>().optional(),
			song: doc<SongDocument>().optional(),
			user: doc<UserDocument>().optional(),
		}),
	},

	"PATCH /scores/:scoreID": {
		description: "Edit a score's comment or highlight status.",
		input: z.object({
			comment: z.string().nullable().optional(),
			highlight: z.boolean().optional(),
		}),
		output: doc<ScoreDocument>(),
	},

	"DELETE /scores/:scoreID": {
		description: "Delete a score.",
		input: z.object({ blacklist: z.boolean().optional() }),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Sessions
	// ────────────────────────────────────────────────

	"GET /sessions/:sessionID": {
		description: "Retrieve a session and its related data.",
		input: z.object({}),
		output: z.strictObject({
			session: doc<SessionDocument>(),
			scores: docArray<ScoreDocument>(),
			charts: docArray<ChartDocument>(),
			songs: docArray<SongDocument>(),
			scoreInfo: docArray<SessionScoreInfo>(),
			user: doc<UserDocument>(),
			index: z.number(),
		}),
	},

	"PATCH /sessions/:sessionID": {
		description: "Update a session's name, description, or highlight status.",
		input: z.object({
			name: z.string().optional(),
			desc: z.string().nullable().optional(),
			highlight: z.boolean().optional(),
		}),
		output: empty,
	},

	"GET /sessions/:sessionID/adjacent": {
		description: "Retrieve the chronologically adjacent sessions (prev/next) for this session.",
		input: z.object({}),
		output: z.strictObject({
			prev: doc<SessionDocument>().nullable(),
			next: doc<SessionDocument>().nullable(),
		}),
	},

	"GET /sessions/:sessionID/folder-raises": {
		description: "Folder raise summary for a session.",
		input: z.object({}),
		output: z.array(
			z.strictObject({
				folder: doc<FolderDocument>(),
				previousCount: z.number().int(),
				raisedCharts: z.array(z.string()),
				totalCharts: z.number().int(),
				type: z.string(),
				value: z.string(),
			}),
		),
	},

	// ────────────────────────────────────────────────
	// Imports (admin-facing view + revert)
	// ────────────────────────────────────────────────

	"GET /imports": {
		description: "List recent imports (admin).",
		input: z.object({
			importType: z.string().optional(),
			userIntent: z.string().optional(),
		}),
		output: z.strictObject({
			imports: docArray<ImportDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /imports/failed": {
		description: "List failed import trackers (admin).",
		input: z.object({
			importType: z.string().optional(),
			userIntent: z.string().optional(),
		}),
		output: z.strictObject({
			failedImports: docArray<ImportTrackerDocument>(),
			users: docArray<UserDocument>(),
		}),
	},

	"GET /imports/:importID": {
		description: "Get an import document.",
		input: z.object({}),
		output: z.strictObject({
			import: doc<ImportDocument>(),
			scores: docArray<ScoreDocument>(),
			songs: docArray<SongDocument>(),
			charts: docArray<ChartDocument>(),
			sessions: docArray<SessionDocument>(),
			user: doc<UserDocument>(),
		}),
	},

	"POST /imports/:importID/revert": {
		description: "Revert an import, deleting all its scores.",
		input: z.object({}),
		output: empty,
	},

	"GET /imports/:importID/poll-status": {
		description: "Poll the status of an in-progress import job.",
		input: z.object({}),
		// Response shape varies based on import state; validated as opaque object.
		output: doc<Record<string, unknown>>(),
	},

	// ────────────────────────────────────────────────
	// Import (user-facing submission)
	// NOTE: POST /import/file uses Multer and is registered separately
	// ────────────────────────────────────────────────

	"POST /import/from-api": {
		description: "Trigger an API-pull import.",
		input: z.object({ importType: z.string() }),
		// Response is either a 202 job handle or an inline import result.
		output: doc<Record<string, unknown>>(),
	},

	"POST /import/orphans": {
		description: "Reprocess orphaned scores.",
		input: z.object({}),
		output: z.strictObject({
			processed: z.number(),
			removed: z.number(),
			failed: z.number(),
			/** Count of orphans successfully converted to scores (not a boolean). */
			success: z.number(),
		}),
	},

	"GET /import/orphans": {
		description:
			"List orphaned scores for the authenticated user (SongOrChartNotFound rows), newest first.",
		input: z.object({
			limit: z.coerce.number().int().min(1).max(100).default(50),
			/** Keyset cursor: `rowID` from the last item of the previous page. */
			after: z.string().optional(),
		}),
		output: z.strictObject({
			orphans: z.array(
				z.strictObject({
					orphanID: z.string(),
					rowID: z.string(),
					importType: z.string(),
					gameGroup: z.string(),
					timeInserted: z.number(),
					message: z.string().nullable(),
					summary: z.string().nullable(),
				}),
			),
			hasMore: z.boolean(),
		}),
	},

	"GET /import/orphans/:orphanID": {
		description:
			"Return one orphaned score for the authenticated user, including raw `data` and `context` JSON.",
		input: z.object({}),
		output: z.strictObject({
			orphanID: z.string(),
			importType: z.string(),
			gameGroup: z.string(),
			timeInserted: z.number(),
			message: z.string().nullable(),
			data: z.unknown(),
			context: z.unknown(),
		}),
	},

	"DELETE /import/orphans/:orphanID": {
		description: "Delete one orphaned score row belonging to the authenticated user.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Clients (OAuth2 clients)
	// ────────────────────────────────────────────────

	"GET /clients": {
		description: "List OAuth2 clients owned by the authenticated user.",
		input: z.object({}),
		output: docArray<TachiAPIClientDocument>(),
	},

	"POST /clients/create": {
		description: "Create a new OAuth2 client.",
		input: z.object({
			name: z.string(),
			redirectUri: z.string().nullish(),
			webhookUri: z.string().nullish(),
			apiKeyTemplate: z.string().nullable().optional(),
			apiKeyFilename: z.string().nullable().optional(),
			permissions: z.array(z.string()).optional(),
		}),
		output: doc<TachiAPIClientDocument>(),
	},

	"GET /clients/:clientID": {
		description: "Get public info for an OAuth2 client.",
		input: z.object({}),
		output: doc<TachiAPIClientDocument>(),
	},

	"PATCH /clients/:clientID": {
		description: "Update an OAuth2 client.",
		input: z.object({
			name: z.string().optional(),
			redirectUri: z.string().nullable().optional(),
			webhookUri: z.string().nullable().optional(),
			apiKeyTemplate: z.string().nullable().optional(),
			apiKeyFilename: z.string().nullable().optional(),
			permissions: z.array(z.string()).optional(),
		}),
		output: doc<TachiAPIClientDocument>(),
	},

	"POST /clients/:clientID/reset-secret": {
		description: "Reset the secret for an OAuth2 client.",
		input: z.object({}),
		output: doc<TachiAPIClientDocument>(),
	},

	"DELETE /clients/:clientID": {
		description: "Delete an OAuth2 client.",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Admin
	// ────────────────────────────────────────────────

	"GET /admin/job-queue": {
		description: "View the job queue (admin only).",
		input: z.object({
			page: z.coerce.number().optional(),
			status: z.string().optional(),
			job_kind: z.string().optional(),
			scope: z.string().optional(),
		}),
		output: z.strictObject({
			activeJobs: docArray<JobQueue>(),
			filters: doc<AdminJobQueueFilters>(),
			jobQueue: z.strictObject({
				items: docArray<JobQueue>(),
				page: z.number(),
				pageSize: z.number(),
				total: z.number(),
			}),
		}),
	},

	"GET /admin/actions": {
		description: "View the admin action log.",
		input: z.object({
			page: z.coerce.number().optional(),
			kind: z.string().optional(),
			username: z.string().optional(),
		}),
		output: z.strictObject({
			actions: z.strictObject({
				items: docArray<ActionRow>(),
				page: z.number(),
				pageSize: z.number(),
				total: z.number(),
			}),
			filters: doc<AdminActionFilters>(),
		}),
	},

	"GET /admin/cron-tasks": {
		description: "View cron task history.",
		input: z.object({}),
		output: z.strictObject({
			tasks: docArray<CronTask>(),
			executions: docArray<CronTaskExecution>(),
		}),
	},

	"POST /admin/recalc-pbs": {
		description:
			"Enqueue every distinct (user_id, chart_id) from the score table into pb_dirty, then synchronously drain pb_dirty and downstream session/game_profile queues until idle. No request body.",
		input: z.object({}),
		output: empty,
	},

	"POST /admin/delete-score": {
		description: "Admin delete a score.",
		input: z.object({ scoreID: z.string() }),
		output: empty,
	},

	"POST /admin/delete-session": {
		description: "Admin delete a session.",
		input: z.object({ sessionID: z.string() }),
		output: empty,
	},

	"POST /admin/destroy-ugpt": {
		description: "Destroy all data for a user on a game+playtype.",
		input: z.object({
			userID: z.number(),
			game: z.enum(ALL_GAMES),
		}),
		output: empty,
	},

	"POST /admin/recalc": {
		description:
			"Enqueue every chart for score re-derivation (derived_data + calculated_data), then synchronously drain score_rederive and downstream pb/session/game_profile queues until idle. No request body.",
		input: z.object({}),
		output: empty,
	},

	"POST /admin/recalc-profiles": {
		description:
			"Enqueue every `game_profile` row and every distinct committed `(user_id, game)` from `score` into `game_profile_dirty`, then synchronously drain that queue until idle (recomputes ratings/classes from current PBs). No request body.",
		input: z.object({}),
		output: empty,
	},

	"POST /admin/announcement": {
		description: "Create a site announcement.",
		input: z.object({
			title: z.string(),
			game: z.string().optional(),
		}),
		output: empty,
	},

	"POST /admin/supporter/:userID": {
		description: "Grant supporter status to a user.",
		input: z.object({}),
		output: empty,
	},

	"DELETE /admin/supporter/:userID": {
		description: "Revoke supporter status from a user.",
		input: z.object({}),
		output: empty,
	},

	"POST /admin/quest-submitter/:userID": {
		description: "Grant quest-submission permission to a user.",
		input: z.object({}),
		output: empty,
	},

	"DELETE /admin/quest-submitter/:userID": {
		description: "Revoke quest-submission permission from a user.",
		input: z.object({}),
		output: empty,
	},

	"POST /admin/rebuild-folder-chart-lookup": {
		description: "Rebuild the folder-chart lookup cache.",
		input: z.object({ folderId: z.string().optional() }),
		output: z.strictObject({ folderCount: z.number(), rowCount: z.number() }),
	},

	"POST /admin/reprocess-all-goals": {
		description: "Reprocess all goals (stub; not yet implemented).",
		input: z.object({}),
		output: empty,
	},

	// ────────────────────────────────────────────────
	// Seeds (local dev only)
	// ────────────────────────────────────────────────

	"GET /seeds": {
		description: "Feature probe for the seeds API.",
		input: z.object({}),
		output: empty,
	},

	"GET /seeds/has-uncommitted-changes": {
		description: "Whether the seeds git repo has uncommitted changes.",
		input: z.object({}),
		output: z.boolean(),
	},

	"GET /seeds/commits": {
		description: "List commits in the seeds repo.",
		input: z.object({
			branch: z.string(),
			file: z.string().optional(),
		}),
		output: docArray<GitCommit>(),
	},

	"GET /seeds/branches": {
		description: "List branches in the seeds repo.",
		input: z.object({}),
		output: z.strictObject({
			branches: z.array(z.strictObject({ name: z.string(), sha: z.string() })),
			current: z.nullable(z.strictObject({ name: z.string(), sha: z.string() })),
		}),
	},

	"GET /seeds/collections": {
		description: "Retrieve seed JSON at an optional revision.",
		input: z.object({ revision: z.string().optional() }),
		output: z.record(z.string(), z.unknown()),
	},

	"GET /seeds/commit": {
		description: "Get metadata for a specific commit in the seeds repo.",
		input: z.object({ sha: z.string() }),
		output: doc<GitCommit>(),
	},

	// ────────────────────────────────────────────────
	// Local dev
	// ────────────────────────────────────────────────

	"GET /localdev/song-seed-status": {
		description: "Whether the song table is empty (for seeding detection).",
		input: z.object({}),
		output: z.strictObject({ missingSongSeeds: z.boolean() }),
	},

	"GET /localdev/first-admin-login": {
		description: "Dev hint for first admin login.",
		input: z.object({}),
		output: z.strictObject({ username: z.string(), password: z.string() }),
	},

	// ────────────────────────────────────────────────
	// Quest Proposals
	// ────────────────────────────────────────────────

	"POST /proposals": {
		description: "Submit quest(s) as a GitHub PR. Requires GITHUB_APP_CONFIG to be set.",
		input: z.object({
			quests: z.array(z.record(z.string(), z.unknown())),
			questlines: z.array(z.record(z.string(), z.unknown())).optional(),
			prTitle: z.string().max(200).optional(),
		}),
		output: z.strictObject({
			proposalID: z.string(),
			prNumber: z.number(),
			prUrl: z.string(),
			status: z.string(),
		}),
	},

	"GET /proposals": {
		description: "List all open quest proposals.",
		input: z.object({ page: z.coerce.number().int().optional() }),
		output: z.strictObject({
			proposals: z.array(
				z.strictObject({
					proposalID: z.string(),
					prNumber: z.number(),
					prUrl: z.string(),
					status: z.string(),
					submitterUsername: z.string(),
					quests: z.array(z.strictObject({ name: z.string(), game: z.string() })),
					createdAt: z.string(),
				}),
			),
			page: z.number(),
		}),
	},

	"GET /proposals/mine": {
		description: "List the calling user's quest proposals.",
		input: z.object({}),
		output: z.strictObject({
			proposals: z.array(
				z.strictObject({
					proposalID: z.string(),
					prNumber: z.number(),
					prUrl: z.string(),
					status: z.string(),
					rawQuests: z.unknown(),
					rawQuestlines: z.unknown(),
					createdAt: z.string(),
					updatedAt: z.string(),
				}),
			),
		}),
	},

	"GET /proposals/:proposalID": {
		description: "Get a single quest proposal with live GitHub PR status.",
		input: z.object({}),
		output: z.strictObject({
			proposalID: z.string(),
			prNumber: z.number(),
			prUrl: z.string(),
			status: z.string(),
			submitterUsername: z.string(),
			rawQuests: z.unknown(),
			rawQuestlines: z.unknown(),
			createdAt: z.string(),
			updatedAt: z.string(),
		}),
	},

	"PUT /proposals/:proposalID": {
		description: "Update quest content of an existing proposal (push new commit to branch).",
		input: z.object({
			quests: z.array(z.record(z.string(), z.unknown())),
			questlines: z.array(z.record(z.string(), z.unknown())).optional(),
			prTitle: z.string().max(200).optional(),
		}),
		output: z.strictObject({
			proposalID: z.string(),
			prNumber: z.number(),
			prUrl: z.string(),
		}),
	},

	"DELETE /proposals/:proposalID": {
		description: "Withdraw (close) a quest proposal.",
		input: z.object({}),
		output: z.strictObject({ proposalID: z.string() }),
	},

	"POST /proposals/webhook/merged": {
		description: "Internal webhook called by github-bot when a quest-proposal PR is merged.",
		input: z.object({ prNumber: z.number() }),
		output: z.strictObject({
			updated: z.boolean(),
			proposalID: z.string().optional(),
		}),
	},
} as const satisfies AnyRouterSpec;

export type APIv1Spec = typeof API_V1_SPEC;
