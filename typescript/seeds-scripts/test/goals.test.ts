import type { GoalDocument, V3Game } from "tachi-common";

import chalk from "chalk";

import {
	buildGoalTitleContext,
	createGoalTitleFromSeeds,
} from "../lib/goals/goal-title-from-seeds";
import { CreateGoalID, ReadCollection } from "../util";

type SeedGoal = { goalID: string; name: string } & GoalDocument;

let exitCode = 0;
let idMismatches = 0;
let nameMismatches = 0;
let checked = 0;

const ctx = buildGoalTitleContext();
const goals = ReadCollection("goals.json") as Array<SeedGoal>;

for (const goal of goals) {
	checked++;

	const expectedGoalID = CreateGoalID(goal.charts, goal.criteria, goal.game);

	if (goal.goalID !== expectedGoalID) {
		idMismatches++;
		console.error(
			chalk.red(`[ERR] goals.json | ${goal.goalID} | goalID mismatch for "${goal.name}".`),
		);
		console.error(chalk.red(`      expected: ${expectedGoalID}`));
		console.error(chalk.red(`      actual:   ${goal.goalID}`));
	}

	let expectedName: string;

	try {
		expectedName = createGoalTitleFromSeeds(
			goal.charts,
			goal.criteria,
			goal.game as V3Game,
			ctx,
		);
	} catch (err) {
		nameMismatches++;
		console.error(
			chalk.red(
				`[ERR] goals.json | ${goal.goalID} | failed to derive name for "${goal.name}".`,
			),
		);
		console.error(chalk.red(`      ${err instanceof Error ? err.message : String(err)}`));
		continue;
	}

	if (goal.name !== expectedName) {
		nameMismatches++;
		console.error(chalk.red(`[ERR] goals.json | ${goal.goalID} | name mismatch.`));
		console.error(chalk.red(`      expected: ${expectedName}`));
		console.error(chalk.red(`      actual:   ${goal.name}`));
	}
}

const failures = idMismatches + nameMismatches;

if (failures > 0) {
	console.error(
		chalk.red(
			`[FAILED] goals.json. Checked ${checked} goals. ` +
				`${idMismatches} goalID mismatch(es), ${nameMismatches} name mismatch(es).`,
		),
	);
	exitCode = 1;
} else {
	console.log(
		chalk.green(`[GOOD] goals.json. All ${checked} goals have correct goalID and name.`),
	);
}

process.exit(exitCode);
