/**
 * TypedRouter middleware functions for the Tachi API.
 *
 * Each function accepts a Request and returns a Promise resolving to a specific context
 * record that gets merged into `data.ctx`. Throwing an ExpectedErr rejects the request.
 */

import type { Request } from "express";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { GetChartByIdForGame } from "#lib/db-formats/chart";
import { LoadFolderDocumentByGameAndSlug } from "#lib/db-formats/folders";
import { SELECT_GAME_PROFILE, ToGameStatsDocument } from "#lib/db-formats/game-profiles";
import { SELECT_GOAL } from "#lib/db-formats/goal";
import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import { SELECT_QUEST } from "#lib/db-formats/quest";
import { LoadScoreDocumentById } from "#lib/db-formats/score";
import { LoadSessionDocumentById } from "#lib/db-formats/session";
import { GetSongByID } from "#lib/db-formats/song";
import { LoadTableDocumentByLegacyId } from "#lib/db-formats/table";
import {
	AttachFolderSlugsToGoals,
	ToGoalDocument,
	ToQuestDocument,
} from "#lib/db-formats/target-documents";
import { AllEnabledGames, Env, ServerConfig, TachiConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { IsEnabledGame, IsEnabledGameGroup } from "#utils/misc";
import { GetClientByID } from "#utils/queries/api-clients";
import { GetQuestlineById } from "#utils/queries/questlines";
import { REQ_AssignToReqTachiData } from "#utils/req-tachi-data";
import { GetUserWithID, IsRequesterAdmin, ResolveUser } from "#utils/user";
import { ExpectedErr } from "bliss";
import {
	type APIPermissions,
	type ChartDocument,
	type FolderDocument,
	type GameGroup,
	GameToGameGroup,
	type GoalDocument,
	type ImportDocument,
	type QuestDocument,
	type QuestlineDocument,
	type ScoreDocument,
	type SessionDocument,
	type SongDocument,
	type TableDocument,
	type TachiAPIClientDocument,
	UserAuthLevels,
	type UserDocument,
	type UserGameStats,
	type V3Game,
} from "tachi-common";

import type { MiddlewareFn } from "./typed-router";

export type { MiddlewareFn } from "./typed-router";

/**
 * Resolves :userID param ("me" or numeric/username) to a user document.
 */
export const withRequestedUser = async (req: Request): Promise<{ requestedUser: UserDocument }> => {
	const paramUserID = req.params.userID;

	if (!paramUserID) {
		throw new ExpectedErr(400, "No userID given.");
	}

	if (paramUserID === "me") {
		const authUserID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (authUserID === null) {
			throw new ExpectedErr(401, "Cannot use 'me' userID with no authentication.");
		}

		if (req.session.tachi?.user) {
			return { requestedUser: req.session.tachi.user };
		}

		const user = await GetUserWithID(authUserID);

		if (!user) {
			throw new ExpectedErr(500, "You are signed in as someone who does not exist.");
		}

		return { requestedUser: user };
	}

	const user = await ResolveUser(paramUserID);

	if (!user) {
		throw new ExpectedErr(404, `The user ${paramUserID} does not exist.`);
	}

	return { requestedUser: user };
};

/**
 * Like {@link withRequestedUser}, but also assigns `requestedUser` onto request
 * tachi data for legacy helpers (e.g. REQ_GetUser, BMS table handlers).
 */
export const withRequestedUserAndReqData: MiddlewareFn = async (req) => {
	const ctx = await withRequestedUser(req);
	REQ_AssignToReqTachiData(req, { requestedUser: ctx.requestedUser });
	return ctx;
};

/**
 * Requires session-level auth where the requester IS the :userID param.
 * Does not return context; only validates the requester.
 */
export const withSelf = (req: Request): Promise<Record<never, never>> => {
	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID === null) {
		throw new ExpectedErr(401, "This endpoint requires session-level authentication.");
	}

	if (auth.token !== null) {
		throw new ExpectedErr(
			403,
			"This request cannot be performed by an API key and requires session authentication as this user.",
		);
	}

	if (!req.session.tachi?.user.id) {
		throw new ExpectedErr(401, "This endpoint requires session-level authentication.");
	}

	const paramUserID = req.params.userID;

	if (paramUserID !== "me" && Number(paramUserID) !== auth.userID) {
		throw new ExpectedErr(403, "You are not permitted to perform this action for this user.");
	}

	return Promise.resolve({} as Record<never, never>);
};

/**
 * Requires the requesting user to be the :userID param or an admin.
 * Does not return context; only validates the requester.
 */
export const withAuthedAsUser = async (req: Request): Promise<Record<never, never>> => {
	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID === null) {
		throw new ExpectedErr(401, "Authentication is required for this endpoint.");
	}

	const requestingUser = await GetUserWithID(auth.userID);

	if (!requestingUser) {
		throw new ExpectedErr(500, "You are signed in as someone who does not exist.");
	}

	if (requestingUser.authLevel === UserAuthLevels.ADMIN) {
		return {} as Record<never, never>;
	}

	const paramUserID = req.params.userID;

	if (paramUserID !== "me" && Number(paramUserID) !== auth.userID) {
		throw new ExpectedErr(403, "You are not authorised as this user.");
	}

	return {} as Record<never, never>;
};

/** Validates the :gameGroup param and returns `{ gameGroup }`. */
export const withGameGroup = (req: Request): Promise<{ gameGroup: GameGroup }> => {
	const gameGroup = req.params.gameGroup;

	if (!gameGroup || !IsEnabledGameGroup(gameGroup)) {
		throw new ExpectedErr(
			400,
			`Invalid/unsupported game ${gameGroup} - Expected one of ${TachiConfig.GAME_GROUPS.join(", ")}`,
		);
	}

	return Promise.resolve({ gameGroup });
};

export const withGame = (req: Request): Promise<{ game: V3Game }> => {
	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(
			400,
			`Invalid/unsupported game ${gameParam} - Expected one of ${AllEnabledGames().join(", ")}`,
		);
	}

	return Promise.resolve({ game: gameParam });
};

/**
 * Like {@link withGame}, but also assigns `game` onto request tachi data for
 * legacy helpers (e.g. REQ_GetGame, BMS table handlers).
 */
export const withGameAndReqData: MiddlewareFn = async (req) => {
	const ctx = await withGame(req);
	REQ_AssignToReqTachiData(req, { game: ctx.game });
	return ctx;
};

/**
 * Resolves the :userID param, validates :game, and loads the
 * user's game stats. Returns `{ game, requestedUser, userGameStats }`.
 */
export const withUserGameProfile = async (
	req: Request,
): Promise<{
	game: V3Game;
	requestedUser: UserDocument;
	userGameStats: UserGameStats;
}> => {
	const paramUserID = req.params.userID;

	if (!paramUserID) {
		throw new ExpectedErr(400, "No userID given.");
	}

	let user: UserDocument;

	if (paramUserID === "me") {
		const authUserID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (authUserID === null) {
			throw new ExpectedErr(401, "Cannot use 'me' userID with no authentication.");
		}

		if (req.session.tachi?.user) {
			user = req.session.tachi.user;
		} else {
			const resolved = await GetUserWithID(authUserID);

			if (!resolved) {
				throw new ExpectedErr(500, "You are signed in as someone who does not exist.");
			}

			user = resolved;
		}
	} else {
		const resolved = await ResolveUser(paramUserID);

		if (!resolved) {
			throw new ExpectedErr(404, `The user ${paramUserID} does not exist.`);
		}

		user = resolved;
	}

	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(
			400,
			`Invalid/unsupported game ${gameParam} - Expected one of ${AllEnabledGames().join(", ")}`,
		);
	}

	const game = gameParam;

	const row = await DB.selectFrom("game_profile")
		.select(SELECT_GAME_PROFILE)
		.where("user_id", "=", user.id)
		.where("game", "=", game)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `The user ${user.username} has not played ${game}`);
	}

	const userGameStats = ToGameStatsDocument(row);

	return { game, requestedUser: user, userGameStats };
};

/** Resolves :scoreID to a score document. Returns `{ scoreDoc }`. */
export const withScore = async (req: Request): Promise<{ scoreDoc: ScoreDocument }> => {
	const score = await LoadScoreDocumentById(req.params.scoreID);

	if (!score) {
		throw new ExpectedErr(404, "This score does not exist.");
	}

	return { scoreDoc: score };
};

/**
 * Requires the authenticated user to own the score at :scoreID (or be admin).
 * Does not return context; only validates ownership.
 */
export const withScoreOwner = async (req: Request): Promise<Record<never, never>> => {
	const score = await LoadScoreDocumentById(req.params.scoreID);

	if (!score) {
		throw new ExpectedErr(404, "This score does not exist.");
	}

	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID === null) {
		throw new ExpectedErr(401, "Authentication is required to modify this score.");
	}

	if (score.userID !== auth.userID) {
		const isAdmin = await IsRequesterAdmin(auth);

		if (!isAdmin) {
			throw new ExpectedErr(403, "You are not authorised to perform this action.");
		}
	}

	return {} as Record<never, never>;
};

/** Resolves :sessionID to a session document. Returns `{ sessionDoc }`. */
export const withSession = async (req: Request): Promise<{ sessionDoc: SessionDocument }> => {
	const session = await LoadSessionDocumentById(req.params.sessionID);

	if (!session) {
		throw new ExpectedErr(404, "This session does not exist.");
	}

	return { sessionDoc: session };
};

/**
 * Requires the authenticated user to own the session at :sessionID.
 * Does not return context; only validates ownership.
 */
export const withSessionOwner = async (req: Request): Promise<Record<never, never>> => {
	const session = await LoadSessionDocumentById(req.params.sessionID);

	if (!session) {
		throw new ExpectedErr(404, "This session does not exist.");
	}

	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID !== session.userID) {
		throw new ExpectedErr(403, "You are not authorised to modify this session.");
	}

	return {} as Record<never, never>;
};

/**
 * Resolves :importID to an import document. Returns `{ importDoc }`.
 */
export const withImport = async (req: Request): Promise<{ importDoc: ImportDocument }> => {
	const importDoc = await LoadImportDocumentById(req.params.importID);

	if (!importDoc) {
		throw new ExpectedErr(404, "This import does not exist.");
	}

	return { importDoc };
};

/**
 * Resolves :chartID for the game in params.
 * Returns `{ chartDoc }`.
 */
export const withChart = async (req: Request): Promise<{ chartDoc: ChartDocument }> => {
	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(400, `Invalid game ${gameParam}.`);
	}

	const game = gameParam;

	const chart = await GetChartByIdForGame(game, req.params.chartID);

	if (!chart) {
		throw new ExpectedErr(404, `The chart ${req.params.chartID} does not exist.`);
	}

	return { chartDoc: chart };
};

/**
 * Resolves :clientID to an API client document (secret stripped).
 * Returns `{ apiClientDoc }`.
 */
export const withClient = async (
	req: Request,
): Promise<{ apiClientDoc: Omit<TachiAPIClientDocument, "clientSecret"> }> => {
	const client = await GetClientByID(req.params.clientID);

	if (!client) {
		throw new ExpectedErr(404, "This client does not exist.");
	}

	const { clientSecret: _secret, ...publicClient } = client;

	return { apiClientDoc: publicClient };
};

/**
 * Resolves :folderSlug to a folder document (requires :game). Returns `{ folderDoc }`.
 */
export const withFolder = async (req: Request): Promise<{ folderDoc: FolderDocument }> => {
	const gpt = await withGame(req);
	const folder = await LoadFolderDocumentByGameAndSlug(gpt.game, req.params.folderSlug);

	if (!folder) {
		throw new ExpectedErr(404, `The folder ${req.params.folderSlug} does not exist.`);
	}

	return { folderDoc: folder };
};

/**
 * Resolves :tableID (legacy string ID) to a table document.
 * Returns `{ tableDoc }`.
 */
export const withTable = async (req: Request): Promise<{ tableDoc: TableDocument }> => {
	const table = await LoadTableDocumentByLegacyId(req.params.tableID);

	if (!table) {
		throw new ExpectedErr(404, `The table ${req.params.tableID} does not exist.`);
	}

	return { tableDoc: table };
};

/**
 * Resolves :songID for the game in params.
 * Returns `{ newSongID, songDoc }`.
 */
export const withSong = async (
	req: Request,
): Promise<{ newSongID: string; songDoc: SongDocument }> => {
	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(400, `Invalid game ${gameParam}.`);
	}

	const gameGroup = GameToGameGroup(gameParam);

	const result = await GetSongByID(gameGroup, req.params.songID);

	if (!result) {
		throw new ExpectedErr(404, `The song ${req.params.songID} does not exist.`);
	}

	return { newSongID: result.newSongID, songDoc: result.doc };
};

/**
 * Resolves :goalID for the game in params.
 * Returns `{ goalDoc }`.
 */
export const withGoal = async (req: Request): Promise<{ goalDoc: GoalDocument }> => {
	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(400, `Invalid game ${gameParam}.`);
	}

	const game = gameParam;

	const row = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", "=", req.params.goalID)
		.where("goal.game", "=", game)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `A goal with ID ${req.params.goalID} doesn't exist.`);
	}

	const goalDoc = ToGoalDocument(row);
	await AttachFolderSlugsToGoals([goalDoc]);

	return { goalDoc };
};

/**
 * Resolves :questID for the game in params.
 * Returns `{ questDoc }`.
 */
export const withQuest = async (req: Request): Promise<{ questDoc: QuestDocument }> => {
	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(400, `Invalid game ${gameParam}.`);
	}

	const game = gameParam;

	const row = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "=", req.params.questID)
		.where("quest.game", "=", game)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `A quest with ID ${req.params.questID} doesn't exist.`);
	}

	return { questDoc: ToQuestDocument(row) };
};

/**
 * Resolves :questlineID for the game in params.
 * Returns `{ questlineDoc }`.
 */
export const withQuestline = async (req: Request): Promise<{ questlineDoc: QuestlineDocument }> => {
	const gameParam = req.params.game;

	if (!gameParam || !IsEnabledGame(gameParam)) {
		throw new ExpectedErr(400, `Invalid game ${gameParam}.`);
	}

	const game = gameParam;

	const questline = await GetQuestlineById(game, req.params.questlineID);

	if (!questline) {
		throw new ExpectedErr(404, `A questline with ID ${req.params.questlineID} doesn't exist.`);
	}

	return { questlineDoc: questline };
};

/**
 * Requires the requesting user to have admin-level auth.
 * Does not return context; only validates.
 */
export const withAdmin = async (req: Request): Promise<Record<never, never>> => {
	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID === null) {
		throw new ExpectedErr(401, "You are not authenticated.");
	}

	const userDoc = await GetUserWithID(auth.userID);

	if (!userDoc) {
		throw new ExpectedErr(500, "An internal error has occurred.");
	}

	if (userDoc.authLevel !== UserAuthLevels.ADMIN) {
		throw new ExpectedErr(403, "You are not authorised to perform this.");
	}

	return {} as Record<never, never>;
};

/**
 * Restricts the route to local development/test environments.
 * Does not return context; only validates.
 */
export const withLocalDev = (_req: Request): Promise<Record<never, never>> => {
	if (Env.NODE_ENV !== "dev" && Env.NODE_ENV !== "test") {
		throw new ExpectedErr(
			403,
			"This endpoint is only available in local development or test environments.",
		);
	}

	return Promise.resolve({} as Record<never, never>);
};

/**
 * Restricts the route to Bokutachi (or omni) instances.
 * Does not return context; only validates.
 */
export const withBokutachi = (_req: Request): Promise<Record<never, never>> => {
	if (TachiConfig.TYPE !== "boku" && TachiConfig.TYPE !== "omni") {
		throw new ExpectedErr(404, `This endpoint is not available on ${TachiConfig.NAME}.`);
	}

	return Promise.resolve({} as Record<never, never>);
};

/**
 * Restricts the route to Kamaitachi (or omni) instances.
 * Does not return context; only validates.
 */
export const withKamaitachi = (_req: Request): Promise<Record<never, never>> => {
	if (TachiConfig.TYPE !== "kamai" && TachiConfig.TYPE !== "omni") {
		throw new ExpectedErr(404, `This endpoint is not available on ${TachiConfig.NAME}.`);
	}

	return Promise.resolve({} as Record<never, never>);
};

/**
 * Restricts the route to instances that have invite codes configured.
 * Does not return context; only validates.
 */
export const withInvitesEnabled = (_req: Request): Promise<Record<never, never>> => {
	if (!ServerConfig.INVITE_CODE_CONFIG) {
		throw new ExpectedErr(404, "Invites are not enabled on this instance.");
	}

	return Promise.resolve({} as Record<never, never>);
};

/**
 * Returns a middleware that requires a specific API permission.
 * Does not return context; only validates.
 *
 * @example
 * router.add("POST /route", withPermission("submit_score"), handler)
 */
export const withPermission =
	(permission: APIPermissions) =>
	(req: Request): Promise<Record<never, never>> => {
		const auth = req[SYMBOL_TACHI_API_AUTH];

		if (!auth.permissions[permission]) {
			throw new ExpectedErr(403, `This request requires the "${permission}" permission.`);
		}

		return Promise.resolve({} as Record<never, never>);
	};
