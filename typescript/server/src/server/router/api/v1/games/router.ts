import { GetRecentActivityForMultipleGames } from "#lib/activity/activity";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { ONE_HOUR } from "#lib/constants/time";
import { LoadFolderDocumentByGameAndSlug, LoadFolderDocumentsByIds } from "#lib/db-formats/folders";
import { ToGameStatsDocument } from "#lib/db-formats/game-profiles";
import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import {
	CountPbsOnChart,
	LoadPbDocumentsForGameSortedByCalculatedAlg,
	LoadPbsOnChartByRankAsc,
	LoadPbsOnChartForUserSearch,
} from "#lib/db-formats/pb";
import { SELECT_QUEST, SELECT_QUEST_SUB_WITH_QUEST_GAME } from "#lib/db-formats/quest";
import { GetSongByID, GetSongsByIDs } from "#lib/db-formats/song";
import {
	GetTableDocumentsForGame,
	LoadTableDocumentByLegacyIdForGame,
} from "#lib/db-formats/table";
import {
	AttachFolderSlugsToGoals,
	ToGoalDocument,
	ToGoalSubscriptionDocument,
	ToQuestDocument,
	ToQuestSubscriptionDocument,
} from "#lib/db-formats/target-documents";
import { GetUGPTSettingsDocument } from "#lib/db-formats/ugpt-settings";
import { SELECT_USER, ToUserDocument } from "#lib/db-formats/user";
import {
	GetFolderChartsAndSongs,
	GetFolderIDsForChartId,
	GetFoldersFromTable,
} from "#lib/folders/folders";
import { log } from "#lib/log/log";
import { withChart, withGame, withGameGroup } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { InvalidScoreFailure } from "#lib/score-import/framework/common/converter-failures";
import { ResolveSongAndChart } from "#lib/score-import/import-types/common/batch-manual/converter";
import { SearchFoldersForGameFtsAndTrgm } from "#lib/search/folders";
import { SearchSpecificGameSongs } from "#lib/search/songs";
import { TachiConfig } from "#lib/setup/config";
import { CreateGoalTitle, ValidateGoalChartsAndCriteria } from "#lib/targets/goal-utils";
import { GetQuestsThatContainGoal } from "#lib/targets/goals";
import { FindStandaloneQuests, GetGoalsInQuest, GetGoalsInQuests } from "#lib/targets/quests";
import DB from "#services/pg/db";
import {
	GetChildQuests,
	GetMostSubscribedGoals,
	GetRecentlyAchievedGoals,
	GetRecentlyAchievedQuests,
	GetRecentlyInteractedGoals,
	GetRecentlyInteractedQuests,
	GetRelevantSongsAndCharts,
} from "#utils/db";
import { EscapeForILIKE, IsString } from "#utils/misc";
import { FindChartsOnPopularity } from "#utils/queries/charts";
import {
	GetQuestlineById,
	GetQuestlinesForGame,
	GetQuestlinesThatContainQuest,
} from "#utils/queries/questlines";
import {
	CheckStrProfileAlg,
	CheckStrScoreAlg,
	ParseStrPositiveNonZeroInt,
} from "#utils/string-checks";
import { GetUsersWithIDs } from "#utils/user";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";
import NodeCache from "node-cache";
import {
	type ChartDocument,
	type FolderDocument,
	type GamesForGroup,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	type GoalDocument,
	type integer,
	LEGACY_FormatGameGroupPT,
	LEGACY_GameToGameGroupPT,
	LEGACY_GetGamePTConfig,
	type UGPTSettingsDocument,
	type UserGameStatsWithProfileLeaderboardRank,
	type V3Game,
} from "tachi-common";

import { API_V1_ROUTER } from "../_singleton";

const gptStatCache = new NodeCache();

async function GetGameStats(
	game: V3Game,
): Promise<{ chartCount: integer; playerCount: integer; scoreCount: integer }> {
	const cacheKey = game;
	const cacheRes = gptStatCache.get(cacheKey);

	if (cacheRes !== undefined) {
		return cacheRes as { chartCount: integer; playerCount: integer; scoreCount: integer };
	}

	const [scoreCount, playerCount, chartCount] = await Promise.all([
		DB.selectFrom("score")
			.select((eb) => eb.fn.countAll().as("c"))
			.where("score.game", "=", game)
			.executeTakeFirst()
			.then((r) => Number(r?.c ?? 0)),
		DB.selectFrom("game_profile")
			.select((eb) => eb.fn.countAll().as("c"))
			.where("game_profile.game", "=", game)
			.executeTakeFirst()
			.then((r) => Number(r?.c ?? 0)),
		DB.selectFrom("chart")
			.select((eb) => eb.fn.countAll().as("c"))
			.where("chart.game", "=", game)
			.executeTakeFirst()
			.then((r) => Number(r?.c ?? 0)),
	]);

	gptStatCache.set(cacheKey, { chartCount, playerCount, scoreCount }, ONE_HOUR);

	return { chartCount, playerCount, scoreCount };
}

/** Vitest: invalidate per-game stats cache after Postgres truncate (same process). */
export function clearGameStatsCacheForTests(): void {
	gptStatCache.flushAll();
}

/**
 * Declares the supported games for this version of tachi.
 *
 * @name GET /api/v1/games
 */
API_V1_ROUTER.add("GET /games", () => {
	const configs = Object.fromEntries(
		TachiConfig.GAME_GROUPS.map((e) => [e, GetGameGroupConfig(e)]),
	);

	return success(`Returned support information for ${TachiConfig.GAME_GROUPS.length} game(s).`, {
		configs,
		supportedGames: TachiConfig.GAME_GROUPS,
	});
});

/**
 * Returns the configuration for this game.
 *
 * @name GET /api/v1/games/:gameGroup
 */
API_V1_ROUTER.add("GET /games/:gameGroup", withGameGroup, ({ ctx }) =>
	success(`Returned information for ${ctx.gameGroup}`, GetGameGroupConfig(ctx.gameGroup)),
);

/**
 * Returns the configuration for this game along with some statistics.
 *
 * @name GET /api/v1/games/:game
 */
API_V1_ROUTER.add("GET /games/:game", withGame, async ({ ctx }) => {
	const v3Game = ctx.game;
	const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(v3Game);

	const { scoreCount, playerCount, chartCount } = await GetGameStats(v3Game);

	return success(`Retrieved information about ${LEGACY_FormatGameGroupPT(gameGroup, playtype)}`, {
		chartCount,
		config: LEGACY_GetGamePTConfig(gameGroup, playtype),
		playerCount,
		scoreCount,
	});
});

/**
 * Returns user-game-stats for this game sorted by the default rating algorithm.
 *
 * @param alg - An alternative algorithm to use.
 * @param limit - How many users to return at most (capped at 500).
 *
 * @name GET /api/v1/games/:game/leaderboard
 */
API_V1_ROUTER.add("GET /games/:game/leaderboard", withGame, async ({ input, ctx }) => {
	const v3Game = ctx.game;
	const gameConfig = GetGameConfig(v3Game);

	const limit = ParseStrPositiveNonZeroInt(String(input.limit ?? "")) ?? 100;

	if (limit > 500) {
		throw new ExpectedErr(400, "Invalid limit. Limit is capped at 500.");
	}

	let alg = gameConfig.defaultProfileRatingAlg;

	if (IsString(input.alg)) {
		const temp = CheckStrProfileAlg(v3Game, input.alg);

		if (temp === null) {
			throw new ExpectedErr(
				400,
				`Invalid value of ${input.alg} for alg. Expected one of ${Object.keys(gameConfig.profileRatingAlgs).join(", ")}`,
			);
		}

		alg = temp;
	}

	const ratingCol = sql<number>`coalesce((game_profile.ratings::jsonb->>${sql.lit(alg)})::numeric, 0)`;

	const gameStats = await DB.selectFrom("game_profile")
		.select([
			"game_profile.user_id",
			"game_profile.game",
			"game_profile.ratings",
			"game_profile.classes",
			sql<number>`RANK() OVER (ORDER BY ${ratingCol} DESC)`.as("rank"),
		])
		.where("game_profile.game", "=", v3Game)
		.orderBy(ratingCol, "desc")
		.limit(limit)
		.execute()
		.then((rows) =>
			rows.map(
				(row): UserGameStatsWithProfileLeaderboardRank => ({
					...ToGameStatsDocument(row),
					rank: Number(row.rank),
				}),
			),
		);

	const users = await GetUsersWithIDs(gameStats.map((e) => e.userID));

	return success(`Returned ${gameStats.length} user's game stats.`, { gameStats, users });
});

/**
 * Returns the best PBs for this game sorted by the default score rating algorithm.
 *
 * @param alg - An alternative algorithm to use.
 * @param limit - How many scores to return (capped at 50).
 *
 * @name GET /api/v1/games/:game/pb-leaderboard
 */
API_V1_ROUTER.add("GET /games/:game/pb-leaderboard", withGame, async ({ input, ctx }) => {
	const v3Game = ctx.game;
	const gameConfig = GetGameConfig(v3Game);

	const limit = ParseStrPositiveNonZeroInt(String(input.limit ?? "")) ?? 50;

	if (limit > 50) {
		throw new ExpectedErr(400, "Cannot specify a limit higher than 50.");
	}

	let alg = gameConfig.defaultScoreRatingAlg;

	if (IsString(input.alg)) {
		const temp = CheckStrScoreAlg(v3Game, input.alg);

		if (temp === null) {
			throw new ExpectedErr(
				400,
				`Invalid value of ${input.alg} for alg. Expected one of ${Object.keys(gameConfig.scoreRatingAlgs).join(", ")}`,
			);
		}

		alg = temp;
	}

	const pbs = await LoadPbDocumentsForGameSortedByCalculatedAlg(v3Game, alg, limit);
	const users = await GetUsersWithIDs(pbs.map((e) => e.userID));
	const { songs, charts } = await GetRelevantSongsAndCharts(pbs);

	return success(`Successfully returned ${pbs.length} pbs.`, { charts, pbs, songs, users });
});

/**
 * Search users that have played this game.
 *
 * @param search - The username to search for.
 *
 * @name GET /api/v1/games/:game/players
 */
API_V1_ROUTER.add("GET /games/:game/players", withGame, async ({ input, ctx }) => {
	const v3Game = ctx.game;

	const gptPlayers = await DB.selectFrom("account")
		.innerJoin("game_profile", "game_profile.user_id", "account.id")
		.select(SELECT_USER)
		.where("game_profile.game", "=", v3Game)
		.where("account.username", "ilike", `%${EscapeForILIKE(input.search)}%`)
		.execute()
		.then((res) => res.map(ToUserDocument));

	return success(`Found ${gptPlayers.length} user(s)`, gptPlayers);
});

/**
 * Retrieve activity for this GPT.
 *
 * @name GET /api/v1/games/:game/activity
 */
API_V1_ROUTER.add("GET /games/:game/activity", withGame, async ({ input, ctx }) => {
	const data = await GetRecentActivityForMultipleGames(
		[ctx.game],
		input.sessions ?? 30,
		input.startTime ?? null,
	);

	return success("Retrieved activity.", data);
});

/**
 * Searches for charts on this game, or returns the 100 most popular if no search given.
 *
 * @param search - The song title to match on.
 * @param noIntelligentOmit - If present, will not perform intelligent chart omissions.
 * @param requesterHasPlayed - If present, only returns charts the requester has a PB on.
 *
 * @name GET /api/v1/games/:game/charts
 */
API_V1_ROUTER.add("GET /games/:game/charts", withGame, async ({ input, ctx, req }) => {
	const v3Game = ctx.game;
	const gameGroup = GameToGameGroup(v3Game);

	let songIDs: Array<string> | undefined;
	let chartIDs: Array<string> | undefined;

	if (IsString(input.search) && input.search.trim() !== "") {
		const songs = await SearchSpecificGameSongs(gameGroup, input.search, 100);
		songIDs = songs.map((e) => e.id);
	}

	if (input.requesterHasPlayed !== undefined) {
		const userID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (userID === null) {
			throw new ExpectedErr(
				401,
				"You must be authorised as a user to use the requesterHasPlayed option.",
			);
		}

		const playedCharts = await DB.selectFrom("pb")
			.innerJoin("chart", "chart.id", "pb.chart_id")
			.select("chart.id as chart_id")
			.distinct()
			.where("pb.user_id", "=", userID)
			.execute();

		chartIDs = playedCharts.map((e) => e.chart_id);
	}

	let charts = (await FindChartsOnPopularity(
		v3Game,
		{ songIDs, chartIDs },
		0,
		100,
	)) as Array<ChartDocument>;

	const songs = await GetSongsByIDs(charts.map((e) => e.song.id));

	// Edge case: for IIDX, filter out 2dxtra charts unless the user has opted in.
	if (gameGroup === "iidx" && input.noIntelligentOmit === undefined) {
		if (req[SYMBOL_TACHI_API_AUTH].userID === null) {
			charts = charts.filter(
				(e) => (e as ChartDocument<GamesForGroup["iidx"]>).data["2dxtraSet"] === null,
			);
		} else {
			const iidxSettings = await GetUGPTSettingsDocument(
				req[SYMBOL_TACHI_API_AUTH].userID,
				v3Game,
			);

			const iidxGameSpecific = iidxSettings?.preferences.gameSpecific as UGPTSettingsDocument<
				GamesForGroup["iidx"]
			>["preferences"]["gameSpecific"];

			if (!iidxGameSpecific?.display2DXTra) {
				charts = charts.filter(
					(e) => (e as ChartDocument<GamesForGroup["iidx"]>).data["2dxtraSet"] === null,
				);
			}
		}
	}

	return success(`Returned ${charts.length} charts.`, { charts, songs });
});

/**
 * Use the tachi resolve engine to identify a chart.
 *
 * @name POST /api/v1/games/:game/charts/resolve
 */
API_V1_ROUTER.add("POST /games/:game/charts/resolve", withGame, async ({ input, ctx }) => {
	const v3Game = ctx.game;

	const safeBody = {
		...input,
		game: v3Game,
	} as Parameters<typeof ResolveSongAndChart>[0];

	let got: Awaited<ReturnType<typeof ResolveSongAndChart>>;
	try {
		got = await ResolveSongAndChart(safeBody, log);
	} catch (err) {
		if (err instanceof InvalidScoreFailure) {
			throw new ExpectedErr(400, err.message);
		}
		throw err;
	}

	if (!got) {
		throw new ExpectedErr(
			404,
			`Could not resolve this chart with details: ${safeBody.matchType}:${safeBody.identifier}`,
		);
	}

	return success("Successfully retrieved chart info.", { chart: got.chart, song: got.song });
});

/**
 * Returns the chart (and the parent song) at this chart ID.
 *
 * @name GET /api/v1/games/:game/charts/:chartID
 */
API_V1_ROUTER.add("GET /games/:game/charts/:chartID", withGame, withChart, async ({ ctx }) => {
	const { chartDoc: chart } = ctx;
	const gameGroup = GameToGameGroup(ctx.game);

	const songRes = await GetSongByID(gameGroup, chart.song.id);

	if (!songRes) {
		log.error(
			`Song ${chart.song.id} does not exist, yet chart ${chart.chartID} has it as a parent?`,
		);
		throw new ExpectedErr(500, "An internal server error has occurred.");
	}

	return success(`Returned chart.`, { chart, song: songRes.doc });
});

/**
 * Returns any folders that contain this chart.
 *
 * @param inactive - Also include inactive folders.
 *
 * @name GET /api/v1/games/:game/charts/:chartID/folders
 */
API_V1_ROUTER.add(
	"GET /games/:game/charts/:chartID/folders",
	withGame,
	withChart,
	async ({ ctx, input }) => {
		const { chartDoc: chart } = ctx;

		const folderIds = await GetFolderIDsForChartId(chart.chartID);
		const byId = await LoadFolderDocumentsByIds(folderIds);
		let folders = folderIds
			.map((id) => byId.get(id))
			.filter((f): f is FolderDocument => f !== undefined);

		if (input.inactive === undefined) {
			folders = folders.filter((f) => !f.inactive);
		}

		return success(`Found ${folders.length} folders that contain this chart.`, folders);
	},
);

/**
 * Returns the total amount of unique players that have played this chart.
 *
 * @name GET /api/v1/games/:game/charts/:chartID/playcount
 */
API_V1_ROUTER.add(
	"GET /games/:game/charts/:chartID/playcount",
	withGame,
	withChart,
	async ({ ctx }) => {
		const { chartDoc: chart } = ctx;
		const count = await CountPbsOnChart(chart.chartID);

		return success("Counted scores for chart.", { count });
	},
);

/**
 * Returns the personal bests for this chart sorted by ranking.
 *
 * @param startRanking - The ranking to start iterating from (defaults to 1).
 *
 * @name GET /api/v1/games/:game/charts/:chartID/pbs
 */
API_V1_ROUTER.add(
	"GET /games/:game/charts/:chartID/pbs",
	withGame,
	withChart,
	async ({ ctx, input }) => {
		const { chartDoc: chart } = ctx;
		const startRanking = ParseStrPositiveNonZeroInt(String(input.startRanking ?? "")) ?? 1;

		const pbs = await LoadPbsOnChartByRankAsc(chart.chartID, startRanking, 100);
		const users = await GetUsersWithIDs(pbs.map((e) => e.userID));

		return success(`Returned ${pbs.length} scores.`, { pbs, users });
	},
);

/**
 * Searches the PBs on this chart by username.
 *
 * @param search - The user to search for.
 *
 * @name GET /api/v1/games/:game/charts/:chartID/pbs/search
 */
API_V1_ROUTER.add(
	"GET /games/:game/charts/:chartID/pbs/search",
	withGame,
	withChart,
	async ({ ctx, input }) => {
		const { chartDoc: chart } = ctx;

		const pbs = await LoadPbsOnChartForUserSearch(chart.chartID, input.search);
		const users = await GetUsersWithIDs(pbs.map((e) => e.userID));

		return success(`Returned ${pbs.length} scores.`, { pbs, users });
	},
);

/**
 * Returns the song at this ID and its child chart documents.
 *
 * @name GET /api/v1/games/:game/songs/:songID
 */
API_V1_ROUTER.add("GET /games/:game/songs/:songID", withGame, async ({ ctx, params }) => {
	const v3Game = ctx.game;
	const songID = params.songID;
	const gameGroup = GameToGameGroup(v3Game);

	const songRes = await GetSongByID(gameGroup, songID);

	if (!songRes) {
		throw new ExpectedErr(404, `No song with ID ${songID} exists.`);
	}

	// TODO(zk) what the fuck?
	const { GetChartsBySongId } = await import("#lib/db-formats/chart"); // avoids circular import
	const charts = await GetChartsBySongId(v3Game, songRes.newSongID);

	return success(`Returned ${charts.length} charts for song ${songRes.doc.title}.`, {
		charts,
		song: songRes.doc,
	});
});

/**
 * Search the folders for this GPT.
 *
 * @param search - The query to search for.
 * @param inactive - Also show inactive folders.
 *
 * @name GET /api/v1/games/:game/folders
 */
API_V1_ROUTER.add("GET /games/:game/folders", withGame, async ({ ctx, input }) => {
	const v3Game = ctx.game;

	const onlyActiveFolders = input.inactive === undefined;

	const folders = await SearchFoldersForGameFtsAndTrgm(v3Game, input.search, {
		limit: 100,
		onlyActiveFolders,
	});

	return success(`Returned ${folders.length} folders.`, folders);
});

/**
 * Get the folder at this ID, alongside its charts and songs.
 *
 * @name GET /api/v1/games/:game/folders/:folderSlug
 */
API_V1_ROUTER.add("GET /games/:game/folders/:folderSlug", withGame, async ({ ctx, params }) => {
	const v3Game = ctx.game;

	const folder = await LoadFolderDocumentByGameAndSlug(v3Game, params.folderSlug);

	if (!folder || folder.game !== v3Game) {
		throw new ExpectedErr(404, `No folder with slug ${params.folderSlug} exists.`);
	}

	const { songs, charts } = await GetFolderChartsAndSongs(folder);

	return success(`Returned data for folder ${folder.title}`, { charts, folder, songs });
});

/**
 * Return all the tables for this game.
 *
 * @param showInactive - If present, also show inactive tables.
 *
 * @name GET /api/v1/games/:game/tables
 */
API_V1_ROUTER.add("GET /games/:game/tables", withGame, async ({ ctx, input }) => {
	const v3Game = ctx.game;

	const includeInactive = input.showInactive !== undefined;
	const tables = await GetTableDocumentsForGame(v3Game, includeInactive);

	if (tables.length === 0) {
		log.error(`The game ${v3Game} has no tables.`);
		throw new ExpectedErr(500, "This game has no tables.");
	}

	return success(`Returned ${tables.length} tables.`, tables);
});

/**
 * Return the folder documents that make up this table.
 *
 * @name GET /api/v1/games/:game/tables/:tableID
 */
API_V1_ROUTER.add("GET /games/:game/tables/:tableID", withGame, async ({ ctx, params }) => {
	const v3Game = ctx.game;

	const table = await LoadTableDocumentByLegacyIdForGame(params.tableID, v3Game);

	if (!table) {
		throw new ExpectedErr(404, `No table with ID ${params.tableID} exists.`);
	}

	const folders = await GetFoldersFromTable(table);

	return success(`Returned ${folders.length} for table ${table.title}.`, { folders, table });
});

/**
 * Retrieve all of this game's recently achieved goals and quests.
 *
 * @name GET /api/v1/games/:game/targets/recently-achieved
 */
API_V1_ROUTER.add("GET /games/:game/targets/recently-achieved", withGame, async ({ ctx }) => {
	const { gameGroup: game, playtype } = LEGACY_GameToGameGroupPT(ctx.game);

	const [{ goals, goalSubs }, { quests, questSubs }] = await Promise.all([
		GetRecentlyAchievedGoals({ game, playtype }),
		GetRecentlyAchievedQuests({ game, playtype }),
	]);

	return success(
		`Retrieved some recently achieved targets for ${LEGACY_FormatGameGroupPT(game, playtype)}`,
		{ goalSubs, goals, questSubs, quests },
	);
});

/**
 * Retrieve all of this game's recently interacted-with goals and quests.
 *
 * @name GET /api/v1/games/:game/targets/recently-raised
 */
API_V1_ROUTER.add("GET /games/:game/targets/recently-raised", withGame, async ({ ctx }) => {
	const { gameGroup: game, playtype } = LEGACY_GameToGameGroupPT(ctx.game);

	const [{ goals, goalSubs }, { quests, questSubs }] = await Promise.all([
		GetRecentlyInteractedGoals({ game, playtype }),
		GetRecentlyInteractedQuests({ game, playtype }),
	]);

	return success(
		`Retrieved some recently interacted-with targets for ${LEGACY_FormatGameGroupPT(game, playtype)}`,
		{ goalSubs, goals, questSubs, quests },
	);
});

/**
 * Get the most popular goals for this GPT.
 *
 * @name GET /api/v1/games/:game/targets/goals/popular
 */
API_V1_ROUTER.add("GET /games/:game/targets/goals/popular", withGame, async ({ ctx }) => {
	const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(ctx.game);

	const goals = await GetMostSubscribedGoals({ game: gameGroup, playtype });

	return success(`Returned ${goals.length} goals.`, goals);
});

/**
 * Given a partial goal, return a formatted name for it.
 *
 * @name POST /api/v1/games/:game/targets/goals/format
 */
API_V1_ROUTER.add("POST /games/:game/targets/goals/format", withGame, async ({ ctx, input }) => {
	const v3Game = ctx.game;

	const charts = input.charts as unknown as GoalDocument["charts"];
	const criteria = input.criteria as unknown as GoalDocument["criteria"];

	try {
		await ValidateGoalChartsAndCriteria(charts, criteria, v3Game);
	} catch (e) {
		const err = e as Error;
		throw new ExpectedErr(400, `Invalid goal: ${err.message}.`);
	}

	const title = await CreateGoalTitle(charts, criteria, v3Game);

	return success("Formatted goal.", title);
});

/**
 * Retrieve information about this goal and who is subscribed to it.
 *
 * @name GET /api/v1/games/:game/targets/goals/:goalID
 */
API_V1_ROUTER.add("GET /games/:game/targets/goals/:goalID", withGame, async ({ ctx, params }) => {
	const v3Game = ctx.game;

	const row = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", "=", params.goalID)
		.where("goal.game", "=", v3Game)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `A goal with ID ${params.goalID} doesn't exist.`);
	}

	const goal = ToGoalDocument(row);
	await AttachFolderSlugsToGoals([goal]);

	const subRows = await DB.selectFrom("goal_sub")
		.innerJoin("goal", "goal.id", "goal_sub.goal_id")
		.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
		.where("goal_sub.goal_id", "=", goal.goalID)
		.execute();

	const goalSubs = subRows.map((r) => ToGoalSubscriptionDocument(r));
	const users = await GetUsersWithIDs(goalSubs.map((e) => e.userID));
	const parentQuests = await GetQuestsThatContainGoal(goal.goalID);

	return success(`Retrieved information about ${goal.name}.`, {
		goal,
		goalSubs,
		parentQuests,
		users,
	});
});

/**
 * Search quests for this GPT.
 *
 * @param search - The query to search for.
 *
 * @name GET /api/v1/games/:game/targets/quests
 */
API_V1_ROUTER.add("GET /games/:game/targets/quests", withGame, async ({ ctx, input }) => {
	const v3Game = ctx.game;

	const likeEsc = EscapeForILIKE(input.search.trim());
	const pattern = `%${likeEsc}%`;

	const rows = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.game", "=", v3Game)
		.where((eb) =>
			eb.or([eb("quest.name", "ilike", pattern), eb("quest.description", "ilike", pattern)]),
		)
		.limit(50)
		.execute();

	const quests = rows.map(ToQuestDocument);
	const goals = await GetGoalsInQuests(quests);

	return success(`Returned ${quests.length} quests.`, { goals, quests });
});

/**
 * Retrieve information about this quest and who is subscribed to it.
 *
 * @name GET /api/v1/games/:game/targets/quests/:questID
 */
API_V1_ROUTER.add("GET /games/:game/targets/quests/:questID", withGame, async ({ ctx, params }) => {
	const v3Game = ctx.game;

	const row = await DB.selectFrom("quest")
		.select(SELECT_QUEST)
		.where("quest.id", "=", params.questID)
		.where("quest.game", "=", v3Game)
		.executeTakeFirst();

	if (!row) {
		throw new ExpectedErr(404, `A quest with ID ${params.questID} doesn't exist.`);
	}

	const quest = ToQuestDocument(row);

	const questSubRows = await DB.selectFrom("quest_sub")
		.innerJoin("quest", "quest.id", "quest_sub.quest_id")
		.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
		.where("quest_sub.quest_id", "=", quest.questID)
		.execute();

	const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));
	const users = await GetUsersWithIDs(questSubs.map((e) => e.userID));
	const goals = await GetGoalsInQuest(quest);

	const parentQuestlines = await GetQuestlinesThatContainQuest(quest.questID);

	return success(`Retrieved information about ${quest.name}.`, {
		goals,
		parentQuestlines,
		quest,
		questSubs,
		users,
	});
});

/**
 * Retrieve all questlines for this GPT. Also returns any standalone quests.
 *
 * @name GET /api/v1/games/:game/targets/questlines
 */
API_V1_ROUTER.add("GET /games/:game/targets/questlines", withGame, async ({ ctx }) => {
	const v3Game = ctx.game;
	const { gameGroup: _gameGroup, playtype } = LEGACY_GameToGameGroupPT(v3Game);

	const questlines = await GetQuestlinesForGame(v3Game);
	const standalone = await FindStandaloneQuests(_gameGroup, playtype);
	const standaloneGoals = await GetGoalsInQuests(standalone);

	return success(`Returned ${questlines.length} questlines.`, {
		questlines,
		standalone,
		standaloneGoals,
	});
});

/**
 * Retrieve a specific questline.
 *
 * @name GET /api/v1/games/:game/targets/questlines/:questlineID
 */
API_V1_ROUTER.add(
	"GET /games/:game/targets/questlines/:questlineID",
	withGame,
	async ({ ctx, params }) => {
		const v3Game = ctx.game;

		const questline = await GetQuestlineById(v3Game, params.questlineID);

		if (!questline) {
			throw new ExpectedErr(404, `A questline with ID ${params.questlineID} doesn't exist.`);
		}

		const quests = await GetChildQuests(questline);
		const goals = await GetGoalsInQuests(quests);

		return success(`Retrieved questline '${questline.name}'.`, { goals, questline, quests });
	},
);
