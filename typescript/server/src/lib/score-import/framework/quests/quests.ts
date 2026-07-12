import type { KtLogger } from "#lib/log/log";

import { SELECT_QUEST, SELECT_QUEST_SUB_WITH_QUEST_GAME } from "#lib/db-formats/quest";
import { ToQuestDocument, ToQuestSubscriptionDocument } from "#lib/db-formats/target-documents";
import { EvaluateQuestProgress, GetGoalIDsFromQuest } from "#lib/targets/quests";
import { EmitWebhookEvent } from "#lib/webhooks/webhooks";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	type GoalImportInfo,
	type integer,
	type QuestDocument,
	type QuestImportInfo,
	type QuestSubscriptionDocument,
	type V3Game,
} from "tachi-common";

export async function UpdateUsersQuests(
	importGoalInfo: Array<GoalImportInfo>,
	game: V3Game,
	userID: integer,
	log: KtLogger,
) {
	const goalIDs = importGoalInfo.map((e) => e.goalID);

	const { quests, questSubs } = await GetRelevantQuests(goalIDs, game, userID, log);

	return UpdateQuestsForUser(quests, questSubs, game, userID, log);
}

export async function UpdateQuestsForUser(
	quests: Array<QuestDocument>,
	questSubs: Array<QuestSubscriptionDocument>,
	game: V3Game,
	userID: integer,
	log: KtLogger,
) {
	const questSubMap = new Map<string, QuestSubscriptionDocument>();

	for (const um of questSubs) {
		questSubMap.set(um.questID, um);
	}

	const importQuestInfo: Array<QuestImportInfo> = [];

	await Promise.all(
		quests.map(async (quest) => {
			const { achieved, progress } = await EvaluateQuestProgress(userID, quest);

			const questSub = questSubMap.get(quest.questID);

			if (!questSub) {
				log.warn(
					`Invalid state achieved in quest processing - processed quest that user did not have? ${quest.questID}`,
				);

				return;
			}

			const questInfo = {
				questID: questSub.questID,
				old: {
					progress: questSub.progress,
					achieved: questSub.achieved,
				},
				new: {
					progress,
					achieved,
				},
			};

			const setPayload: {
				achieved: boolean;
				last_interaction?: string;
				progress: number;
				time_achieved?: string | null;
			} = {
				progress,
				achieved,
			};

			if (progress !== questSub.progress) {
				importQuestInfo.push(questInfo);
				setPayload.last_interaction = UnixMillisecondsToISO8601(Date.now());
			}

			if (achieved && !questSub.achieved) {
				void EmitWebhookEvent({
					type: "quest-achieved/v1",
					content: {
						userID,
						...questInfo,
						game,
					},
				});

				setPayload.time_achieved = UnixMillisecondsToISO8601(Date.now());
			}

			await DB.updateTable("quest_sub")
				.set(setPayload)
				.where("quest_sub.quest_id", "=", quest.questID)
				.where("quest_sub.user_id", "=", userID)
				.execute();
		}),
	);

	return importQuestInfo;
}

async function GetRelevantQuests(
	goalIDs: Array<string>,
	game: V3Game,
	userID: integer,
	log: KtLogger,
) {
	if (goalIDs.length === 0) {
		return { quests: [] as Array<QuestDocument>, questSubs: [] };
	}

	const goalIdSet = new Set(goalIDs);

	const questSubRows = await DB.selectFrom("quest_sub")
		.innerJoin("quest", "quest.id", "quest_sub.quest_id")
		.select(SELECT_QUEST_SUB_WITH_QUEST_GAME)
		.where("quest_sub.user_id", "=", userID)
		.where("quest.game", "=", game)
		.execute();

	log.debug(`Found ${questSubRows.length} quest-subs.`);

	const questSubs = questSubRows.map((r) => ToQuestSubscriptionDocument(r));

	const questIds = [...new Set(questSubRows.map((r) => r.quest_id))];

	const questRows =
		questIds.length === 0
			? []
			: await DB.selectFrom("quest")
					.select(SELECT_QUEST)
					.where("quest.id", "in", questIds)
					.execute();

	const quests = questRows
		.map(ToQuestDocument)
		.filter((q) => GetGoalIDsFromQuest(q).some((gid) => goalIdSet.has(gid)));

	log.debug(`Found ${quests.length} relevant quests.`);

	return { quests, questSubs };
}
