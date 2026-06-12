/**
 * Fix SDVX UC quest goals that still use lamp threshold 3 (pre-MAXXIVE UC index).
 * After SDVX6, index 3 is MAXXIVE CLEAR and UC is index 4.
 *
 * Run: bun typescript/seeds-scripts/rerunners/sdvx/fix-uc-goal-lamp-thresholds.ts
 */

import { log as logger } from "../../log.ts";
import { CreateGoalID, MutateCollection, ReadCollection, WriteCollection } from "../../util.js";

const OLD_UC_LAMP_THRESHOLD = 3;
const NEW_UC_LAMP_THRESHOLD = 4;

const translateMap = new Map<string, string>();

const origGoals = ReadCollection("goals.json", true);

MutateCollection("goals.json", (goals) => {
	logger.info("Bumping SDVX UC lamp thresholds from 3 to 4.");

	let updated = 0;

	for (const goal of goals) {
		if (goal.game !== "sdvx") {
			continue;
		}

		if (goal.criteria?.key !== "lamp") {
			continue;
		}

		if (goal.criteria.value !== OLD_UC_LAMP_THRESHOLD) {
			continue;
		}

		const oldGoalID = goal.goalID;

		goal.criteria = {
			...goal.criteria,
			value: NEW_UC_LAMP_THRESHOLD,
		};

		const newGoalID = CreateGoalID(goal.charts, goal.criteria, goal.game);

		if (newGoalID !== oldGoalID) {
			translateMap.set(oldGoalID, newGoalID);
			goal.goalID = newGoalID;
			updated++;
			logger.info(`  ${oldGoalID} -> ${newGoalID} (${goal.name})`);
		}
	}

	logger.info(`Updated ${updated} SDVX UC goals.`);

	return goals;
});

try {
	MutateCollection("quests.json", (quests) => {
		logger.info("Updating quest goalID references.");

		let patched = 0;

		for (const quest of quests) {
			for (const qd of quest.questData) {
				for (const goal of qd.goals) {
					if (translateMap.has(goal.goalID)) {
						goal.goalID = translateMap.get(goal.goalID)!;
						patched++;
					}
				}
			}
		}

		logger.info(`Patched ${patched} quest goal references.`);

		return quests;
	});
} catch (err) {
	logger.error("Failed to update quests.json, reverting goals.json.", { err });
	WriteCollection("goals.json", origGoals);
	throw err;
}
