import { log as logger } from "../log.ts";
import { CreateGoalID, MutateCollection, ReadCollection, WriteCollection } from "../util.js";

const translateMap = new Map();

const origGoals = ReadCollection("goals.json", true);

MutateCollection("goals.json", (goals) => {
	logger.info("Updating goals.");

	for (const goal of goals) {
		const expectedGoalID = CreateGoalID(goal.charts, goal.criteria, goal.game, goal.playtype);

		if (expectedGoalID !== goal.goalID) {
			translateMap.set(goal.goalID, expectedGoalID);
			goal.goalID = expectedGoalID;
		}
	}

	return goals;
});

try {
	MutateCollection("quests.json", (quests) => {
		logger.info("Updating Quests.");

		for (const quest of quests) {
			const newQuestData = [];

			for (const qd of quest.questData) {
				const goals = [];

				for (const goal of qd.goals) {
					if (translateMap.has(goal.goalID)) {
						goals.push({ ...goal, goalID: translateMap.get(goal.goalID) });
					} else {
						goals.push(goal);
					}
				}

				newQuestData.push({
					...qd,
					goals,
				});
			}

			quest.questData = newQuestData;
		}

		logger.info("Done.");

		return quests;
	});
} catch (err) {
	logger.error("Failed to update tables.json, reverting all auto-folder fixes.", { err });
	WriteCollection("goals.json", origGoals);
}
