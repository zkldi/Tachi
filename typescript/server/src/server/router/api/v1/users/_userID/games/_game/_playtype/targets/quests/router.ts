import { SELECT_QUEST, SELECT_QUEST_SUB_WITH_QUEST_GAME } from "#lib/db-formats/quest";
import { ToQuestDocument, ToQuestSubscriptionDocument } from "#lib/db-formats/target-documents";
import { withUserGameProfile } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import DB from "#services/pg/db";
import { ExpectedErr } from "bliss";
import { sql } from "kysely";

/**
 * Retrieves this user's subscribed quests.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/quests
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/quests",
	withUserGameProfile,
	async ({ ctx }) => {
		const { requestedUser: user, game } = ctx;

		const { GetGoalsInQuests } = await import("#lib/targets/quests");

		const questSubRows = await DB.selectFrom("quest_sub")
			.innerJoin("quest", "quest.id", "quest_sub.quest_id")
			.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
			.where("quest_sub.user_id", "=", user.id)
			.where("quest.game", "=", game)
			.execute();

		const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));
		const questIds = questSubs.map((e) => e.questID);

		const questRows =
			questIds.length === 0
				? []
				: await DB.selectFrom("quest")
						.select(SELECT_QUEST)
						.where("quest.id", "in", questIds)
						.execute();

		const quests = questRows.map(ToQuestDocument);
		const goals = await GetGoalsInQuests(quests);

		return success(`Retrieved ${questSubs.length} quest(s).`, { goals, questSubs, quests });
	},
);

/**
 * Returns this user's progress on this quest.
 *
 * @name GET /api/v1/users/:userID/games/:game/targets/quests/:questID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/targets/quests/:questID",
	withUserGameProfile,
	async ({ ctx, params }) => {
		const { requestedUser: user, game } = ctx;

		const { EvaluateQuestProgress } = await import("#lib/targets/quests");

		const questRow = await DB.selectFrom("quest")
			.select(SELECT_QUEST)
			.where("quest.id", "=", params.questID)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		if (!questRow) {
			throw new ExpectedErr(404, `Can't find a quest with id '${params.questID}'.`);
		}

		const quest = ToQuestDocument(questRow);

		const questSubRow = await DB.selectFrom("quest_sub")
			.innerJoin("quest", "quest.id", "quest_sub.quest_id")
			.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
			.where("quest_sub.user_id", "=", user.id)
			.where("quest_sub.quest_id", "=", params.questID)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		if (!questSubRow) {
			throw new ExpectedErr(404, `${user.username} is not subscribed to this quest.`);
		}

		const questSub = ToQuestSubscriptionDocument(questSubRow);
		const { goalResults: results, goals } = await EvaluateQuestProgress(user.id, quest);

		return success(`Returned information about ${user.username}'s progress on ${quest.name}.`, {
			goals,
			quest,
			questSub,
			results,
		});
	},
);

/**
 * Subscribe to a quest.
 *
 * @name PUT /api/v1/users/:userID/games/:game/targets/quests/:questID
 */
API_V1_ROUTER.add(
	"PUT /users/:userID/games/:game/targets/quests/:questID",
	withUserGameProfile,
	async ({ ctx, params, req }) => {
		const { requestedUser: user, game } = ctx;

		if (!req.session.tachi?.user) {
			throw new ExpectedErr(401, "You are not authenticated.");
		}

		const { SubscribeFailReasons } = await import("#lib/constants/err-codes");
		const { SubscribeToQuest } = await import("#lib/targets/quests");
		const { ServerConfig } = await import("#lib/setup/config");

		const countRow = await DB.selectFrom("quest_sub")
			.innerJoin("quest", "quest.id", "quest_sub.quest_id")
			.select(sql<number>`count(*)::int`.as("c"))
			.where("quest_sub.user_id", "=", user.id)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		const existingQuestsCount = Number(countRow?.c ?? 0);

		if (existingQuestsCount > ServerConfig.MAX_QUEST_SUBSCRIPTIONS) {
			throw new ExpectedErr(
				400,
				`You already have ${ServerConfig.MAX_QUEST_SUBSCRIPTIONS} quests. You cannot have anymore for this game.`,
			);
		}

		const questRow = await DB.selectFrom("quest")
			.select(SELECT_QUEST)
			.where("quest.id", "=", params.questID)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		if (!questRow) {
			throw new ExpectedErr(404, `Can't find a quest with id '${params.questID}'.`);
		}

		const quest = ToQuestDocument(questRow);

		const alreadySubscribed = await DB.selectFrom("quest_sub")
			.innerJoin("quest", "quest.id", "quest_sub.quest_id")
			.select("quest_sub.quest_id")
			.where("quest_sub.user_id", "=", user.id)
			.where("quest_sub.quest_id", "=", quest.questID)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		if (alreadySubscribed) {
			throw new ExpectedErr(409, "You are already subscribed to this quest.");
		}

		const subResult = await SubscribeToQuest(user.id, quest, false);

		if (subResult === SubscribeFailReasons.ALREADY_SUBSCRIBED) {
			throw new ExpectedErr(409, "You're already subscribed to this quest.");
		}

		return success(`Subscribed to quest '${quest.name}'.`, { ...subResult, quest });
	},
);

/**
 * Unsubscribe from a quest.
 *
 * @name DELETE /api/v1/users/:userID/games/:game/targets/quests/:questID
 */
API_V1_ROUTER.add(
	"DELETE /users/:userID/games/:game/targets/quests/:questID",
	withUserGameProfile,
	async ({ ctx, params, req }) => {
		const { requestedUser: user, game } = ctx;

		if (!req.session.tachi?.user) {
			throw new ExpectedErr(401, "You are not authenticated.");
		}

		const { UnsubscribeFromQuest } = await import("#lib/targets/quests");

		const questRow = await DB.selectFrom("quest")
			.select(SELECT_QUEST)
			.where("quest.id", "=", params.questID)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		if (!questRow) {
			throw new ExpectedErr(404, `Can't find a quest with id '${params.questID}'.`);
		}

		const quest = ToQuestDocument(questRow);

		const row = await DB.selectFrom("quest_sub")
			.innerJoin("quest", "quest.id", "quest_sub.quest_id")
			.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
			.where("quest_sub.user_id", "=", user.id)
			.where("quest_sub.quest_id", "=", quest.questID)
			.where("quest.game", "=", game)
			.executeTakeFirst();

		if (!row) {
			throw new ExpectedErr(
				409,
				"Can't unsubscribe from a quest you were never subscribed to.",
			);
		}

		const questSub = ToQuestSubscriptionDocument(row);
		await UnsubscribeFromQuest(questSub, quest);

		return success("Unsubscribed from quest.", { quest });
	},
);
