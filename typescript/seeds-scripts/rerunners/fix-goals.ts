/**
 * Re-derive goalID and name for every row in goals.json from charts, criteria, and game.
 *
 * Run: bun typescript/seeds-scripts/rerunners/fix-goals.ts
 */

import { type V3Game } from "tachi-common";

import {
	buildGoalTitleContext,
	createGoalTitleFromSeeds,
} from "../lib/goals/goal-title-from-seeds.ts";
import { log as logger } from "../log.ts";
import { CreateGoalID, MutateCollection, ReadCollection, WriteCollection } from "../util.js";

const translateMap = new Map<string, string>();
const origGoals = ReadCollection("goals.json", true);
const ctx = buildGoalTitleContext();

MutateCollection("goals.json", (goals) => {
	logger.info("Re-deriving goalID and name for all goals.");

	let idUpdates = 0;
	let nameUpdates = 0;

	for (const goal of goals) {
		const oldGoalID = goal.goalID;
		const oldName = goal.name;

		const newGoalID = CreateGoalID(goal.charts, goal.criteria, goal.game);
		const newName = createGoalTitleFromSeeds(
			goal.charts,
			goal.criteria,
			goal.game as V3Game,
			ctx,
		);

		if (newGoalID !== oldGoalID) {
			translateMap.set(oldGoalID, newGoalID);
			goal.goalID = newGoalID;
			idUpdates++;
			logger.info(`  goalID ${oldGoalID} -> ${newGoalID}`);
		}

		if (newName !== oldName) {
			goal.name = newName;
			nameUpdates++;
			logger.info(`  name "${oldName}" -> "${newName}"`);
		}
	}

	logger.info(`Updated ${idUpdates} goalID(s) and ${nameUpdates} name(s).`);

	return goals;
});

if (translateMap.size > 0) {
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

			logger.info(`Patched ${patched} quest goal reference(s).`);

			return quests;
		});
	} catch (err) {
		logger.error("Failed to update quests.json, reverting goals.json.", { err });
		WriteCollection("goals.json", origGoals);
		throw err;
	}
}
