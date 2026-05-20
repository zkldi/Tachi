import { GetChartByIdForGame } from "#lib/db-formats/chart";
import { LoadFolderDocumentByGameAndSlug } from "#lib/db-formats/folders";
import { SELECT_GOAL, SELECT_GOAL_SUB_WITH_GOAL_GAME } from "#lib/db-formats/goal";
import { SELECT_QUEST, SELECT_QUEST_SUB_WITH_QUEST_GAME } from "#lib/db-formats/quest";
import {
	AttachFolderSlugsToGoals,
	ToGoalDocument,
	ToGoalSubscriptionDocument,
	ToQuestDocument,
	ToQuestSubscriptionDocument,
} from "#lib/db-formats/target-documents";
import { GetFolderChartIDs } from "#lib/folders/folders";
import { log } from "#lib/log/log";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { GetRelevantGoals } from "#lib/targets/goals";
import { GetParentQuests } from "#lib/targets/quests";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import {
	GetRecentlyAchievedGoals,
	GetRecentlyAchievedQuests,
	GetRecentlyInteractedGoals,
	GetRecentlyInteractedQuests,
} from "#utils/db";
import { ExpectedErr } from "bliss";
import { LEGACY_GameToGameGroupPT } from "tachi-common";

/**
 * Return a user's recently achieved goals and quests.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/recently-achieved
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/recently-achieved",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;
		const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);

		const [{ goals, goalSubs }, { quests, questSubs }] = await Promise.all([
			GetRecentlyAchievedGoals({ game: gameGroup, playtype, userID: user.id }),
			GetRecentlyAchievedQuests({ game: gameGroup, playtype, userID: user.id }),
		]);

		return success(`Returned ${user.username}'s recently achieved targets.`, {
			goalSubs,
			goals,
			questSubs,
			quests,
			user,
		});
	},
);

/**
 * Returns a user's recently interacted with goals and quests.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/recently-raised
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/recently-raised",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;
		const { gameGroup, playtype } = LEGACY_GameToGameGroupPT(game);

		const [{ goals, goalSubs }, { quests, questSubs }] = await Promise.all([
			GetRecentlyInteractedGoals({ game: gameGroup, playtype, userID: user.id }),
			GetRecentlyInteractedQuests({ game: gameGroup, playtype, userID: user.id }),
		]);

		return success(`Returned ${user.username}'s recently achieved targets.`, {
			goalSubs,
			goals,
			questSubs,
			quests,
			user,
		});
	},
);

/**
 * Find what targets this user has set that consider this chart.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/on-chart/:chartID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/on-chart/:chartID",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const chart = await GetChartByIdForGame(game, params.chartID);

		if (!chart) {
			throw new ExpectedErr(404, `Failed to find a chart with chartID '${params.chartID}'.`);
		}

		const { goals, goalSubsMap } = await GetRelevantGoals(
			game,
			user.id,
			new Set([chart.chartID]),
			log,
			false,
		);

		const goalSubs = [...goalSubsMap.values()];
		const quests = await GetParentQuests(user.id, game, goalSubs);
		const questIds = quests.map((e) => e.questID);

		const questSubRows =
			questIds.length === 0
				? []
				: await DB.selectFrom("quest_sub")
						.innerJoin("quest", "quest.id", "quest_sub.quest_id")
						.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
						.where("quest_sub.user_id", "=", user.id)
						.where("quest.game", "=", game)
						.where("quest_sub.quest_id", "in", questIds)
						.execute();

		const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));

		await AttachFolderSlugsToGoals(goals);

		return success("Found pertinent goals", { goalSubs, goals, questSubs, quests });
	},
);

/**
 * Find what targets this user has set that involve this folder.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/on-folder/:folderSlug
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/on-folder/:folderSlug",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser, game } = ctx;

		const folder = await LoadFolderDocumentByGameAndSlug(game, params.folderSlug);

		if (!folder || folder.game !== game) {
			throw new ExpectedErr(404, `Failed to find a folder with slug '${params.folderSlug}'.`);
		}

		const folderChartIDs = await GetFolderChartIDs(folder.folderID);

		const allSubRows = await DB.selectFrom("goal_sub")
			.innerJoin("goal", "goal.id", "goal_sub.goal_id")
			.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
			.where("goal_sub.user_id", "=", requestedUser.id)
			.where("goal.game", "=", game)
			.execute();

		const allGoalSubs = allSubRows.map((r) => ToGoalSubscriptionDocument(r));
		const goalIDs = allGoalSubs.map((e) => e.goalID);

		const goalDocRows =
			goalIDs.length === 0
				? []
				: await DB.selectFrom("goal")
						.select(SELECT_GOAL)
						.where("goal.id", "in", goalIDs)
						.execute();

		const goals: Array<ReturnType<typeof ToGoalDocument>> = [];

		for (const row of goalDocRows) {
			const g = ToGoalDocument(row);

			if (g.charts.type === "single" && folderChartIDs.includes(g.charts.data)) {
				goals.push(g);
			} else if (
				g.charts.type === "multi" &&
				g.charts.data.some((c: string) => folderChartIDs.includes(c))
			) {
				goals.push(g);
			} else if (g.charts.type === "folder" && g.charts.data === folder.folderID) {
				goals.push(g);
			}
		}

		const filteredGoalSubs = allGoalSubs.filter((s) =>
			goals.find((g) => g.goalID === s.goalID),
		);

		const quests = await GetParentQuests(requestedUser.id, game, filteredGoalSubs);
		const questIds = quests.map((e) => e.questID);

		const questSubRows =
			questIds.length === 0
				? []
				: await DB.selectFrom("quest_sub")
						.innerJoin("quest", "quest.id", "quest_sub.quest_id")
						.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
						.where("quest_sub.user_id", "=", requestedUser.id)
						.where("quest.game", "=", game)
						.where("quest_sub.quest_id", "in", questIds)
						.execute();

		const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));

		await AttachFolderSlugsToGoals(goals);

		return success("Found pertinent goals.", {
			folder,
			goalSubs: filteredGoalSubs,
			goals,
			quests,
			questSubs,
		});
	},
);

/**
 * Retrieve all of this user's goal and quest subscriptions.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/all-subs
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/all-subs",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const [goalSubRows, questSubRows] = await Promise.all([
			DB.selectFrom("goal_sub")
				.innerJoin("goal", "goal.id", "goal_sub.goal_id")
				.select(SELECT_GOAL_SUB_WITH_GOAL_GAME)
				.where("goal_sub.user_id", "=", user.id)
				.where("goal.game", "=", game)
				.execute(),
			DB.selectFrom("quest_sub")
				.innerJoin("quest", "quest.id", "quest_sub.quest_id")
				.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
				.where("quest_sub.user_id", "=", user.id)
				.where("quest.game", "=", game)
				.execute(),
		]);

		const goalSubs = goalSubRows.map(ToGoalSubscriptionDocument);
		const questSubs = questSubRows.map(ToQuestSubscriptionDocument);

		const goalIds = goalSubs.map((e) => e.goalID);
		const goalRows =
			goalIds.length === 0
				? []
				: await DB.selectFrom("goal")
						.select(SELECT_GOAL)
						.where("goal.id", "in", goalIds)
						.execute();
		const goals = goalRows.map(ToGoalDocument);
		await AttachFolderSlugsToGoals(goals);

		const questIds = questSubs.map((e) => e.questID);
		const questRows =
			questIds.length === 0
				? []
				: await DB.selectFrom("quest")
						.select(SELECT_QUEST)
						.where("quest.id", "in", questIds)
						.execute();
		const quests = questRows.map(ToQuestDocument);

		return success("Returned all target subscriptions.", {
			goalSubs,
			goals,
			questSubs,
			quests,
		});
	},
);
