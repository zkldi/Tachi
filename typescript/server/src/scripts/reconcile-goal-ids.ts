/**
 * Reconcile goal rows with their canonical id and display name.
 *
 * Goal ids are `CreateGoalID(charts, criteria, game)`. Names come from
 * `CreateGoalTitle(charts, criteria, game)`. When either drifts (e.g. after a
 * criteria fix without rehashing), this script repairs rows. `goal_sub` and
 * `import_goal` follow id renames via ON UPDATE CASCADE (see migration
 * goal_id_on_update_cascade).
 *
 * Quest goal references in `quest.quest_data` are updated separately (JSON, not FK).
 *
 * Goals are scanned in primary-key order, one batch at a time, so the full table
 * is never loaded into memory.
 *
 * Run:
 *   bun run src/scripts/reconcile-goal-ids.ts
 *   bun run src/scripts/reconcile-goal-ids.ts --dry-run
 *   bun run src/scripts/reconcile-goal-ids.ts --batch-size 1000
 */

import { SELECT_GOAL } from "#lib/db-formats/goal";
import { ToGoalDocument } from "#lib/db-formats/target-documents";
import { log } from "#lib/log/log";
import { CreateGoalTitle } from "#lib/targets/goal-utils";
import { CreateGoalID, mergeGoalSubscriptions, remapGoalIdInQuests } from "#lib/targets/goals";
import DB from "#services/pg/db";
import { parseArgs } from "node:util";
import { type GoalDocument } from "tachi-common";

const DEFAULT_BATCH_SIZE = 500;

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		"batch-size": { type: "string" },
		"dry-run": { type: "boolean" },
		help: { type: "boolean", short: "h" },
	},
});

if (values.help) {
	console.log(`
reconcile-goal-ids — align goal.id and goal.name with charts + criteria

  --batch-size <n>  Goals per DB fetch (default ${DEFAULT_BATCH_SIZE})
  --dry-run         Log changes without writing
  -h, --help        Show this help
`);
	process.exit(0);
}

const cliDryRun = values["dry-run"] ?? false;
const batchSize = Math.max(
	1,
	Number.parseInt(values["batch-size"] ?? "", 10) || DEFAULT_BATCH_SIZE,
);

function canonicalGoalId(goal: GoalDocument): string {
	return CreateGoalID(goal.charts, goal.criteria, goal.game);
}

async function canonicalGoalName(goal: GoalDocument): Promise<string | null> {
	try {
		return await CreateGoalTitle(goal.charts, goal.criteria, goal.game);
	} catch (err) {
		log.warn(
			{ err, goalID: goal.goalID, game: goal.game },
			`Could not derive goal name for ${goal.goalID}; skipping name update.`,
		);
		return null;
	}
}

async function loadGoalBatch(afterId: string, limit: number): Promise<Array<GoalDocument>> {
	const rows = await DB.selectFrom("goal")
		.select(SELECT_GOAL)
		.where("goal.id", ">", afterId)
		.orderBy("goal.id", "asc")
		.limit(limit)
		.execute();

	return rows.map(ToGoalDocument);
}

async function loadExistingGoalIds(goalIds: Array<string>): Promise<Set<string>> {
	if (goalIds.length === 0) {
		return new Set();
	}

	const rows = await DB.selectFrom("goal")
		.select("goal.id")
		.where("goal.id", "in", goalIds)
		.execute();

	return new Set(rows.map((r) => r.id));
}

async function reconcileGoalId(
	goal: GoalDocument,
	expectedId: string,
	expectedName: string | null,
	targetExists: boolean,
	isDryRun: boolean,
): Promise<"merged" | "renamed"> {
	if (isDryRun) {
		log.info(
			targetExists
				? `[dry-run] Would merge ${goal.goalID} -> ${expectedId} (${goal.name})`
				: `[dry-run] Would rename ${goal.goalID} -> ${expectedId} (${goal.name})`,
		);
		return targetExists ? "merged" : "renamed";
	}

	await remapGoalIdInQuests(goal.goalID, expectedId);

	if (targetExists) {
		await mergeGoalSubscriptions(goal.goalID, expectedId);
		await DB.deleteFrom("goal").where("goal.id", "=", goal.goalID).execute();
		log.info(`Merged ${goal.goalID} -> ${expectedId} (${goal.name})`);
		return "merged";
	}

	const update: { id: string; name?: string } = { id: expectedId };

	if (expectedName !== null) {
		update.name = expectedName;
	}

	await DB.updateTable("goal").set(update).where("goal.id", "=", goal.goalID).execute();

	log.info(`Renamed ${goal.goalID} -> ${expectedId} (${goal.name})`);
	return "renamed";
}

async function reconcileGoalName(
	goal: GoalDocument,
	expectedName: string,
	isDryRun: boolean,
): Promise<boolean> {
	if (goal.name === expectedName) {
		return false;
	}

	if (isDryRun) {
		log.info(`[dry-run] Would rename goal ${goal.goalID}: "${goal.name}" -> "${expectedName}"`);
		return true;
	}

	await DB.updateTable("goal")
		.set({ name: expectedName })
		.where("goal.id", "=", goal.goalID)
		.execute();

	log.info(`Updated goal name ${goal.goalID}: "${goal.name}" -> "${expectedName}"`);
	return true;
}

export async function reconcileGoalIds(options?: { batchSize?: number; dryRun?: boolean }) {
	const isDryRun = options?.dryRun ?? cliDryRun;
	const limit = options?.batchSize ?? batchSize;

	let renamed = 0;
	let merged = 0;
	let namesUpdated = 0;
	let skipped = 0;
	let scanned = 0;
	let afterId = "";

	for (;;) {
		const batch = await loadGoalBatch(afterId, limit);

		if (batch.length === 0) {
			break;
		}

		scanned += batch.length;

		const drifted = batch.filter((goal) => canonicalGoalId(goal) !== goal.goalID);
		const expectedIds = [...new Set(drifted.map((goal) => canonicalGoalId(goal)))];
		const existingIds = await loadExistingGoalIds(expectedIds);

		for (const goal of batch) {
			const expectedId = canonicalGoalId(goal);
			const expectedName = await canonicalGoalName(goal);

			if (expectedId !== goal.goalID) {
				const targetExists = existingIds.has(expectedId);
				const result = await reconcileGoalId(
					goal,
					expectedId,
					expectedName,
					targetExists,
					isDryRun,
				);

				if (result === "renamed") {
					renamed++;
				} else {
					merged++;
				}

				continue;
			}

			if (expectedName !== null && goal.name !== expectedName) {
				if (await reconcileGoalName(goal, expectedName, isDryRun)) {
					namesUpdated++;
				}
			} else {
				skipped++;
			}
		}

		afterId = batch[batch.length - 1]!.goalID;

		log.info(`reconcile-goal-ids: scanned ${scanned} goals (batch through ${afterId})`);

		if (batch.length < limit) {
			break;
		}
	}

	log.info(
		`reconcile-goal-ids complete: ${scanned} scanned, ${renamed} id-renamed, ${merged} merged, ${namesUpdated} names updated, ${skipped} unchanged.`,
	);

	return { renamed, merged, namesUpdated, skipped, scanned };
}

if (require.main === module) {
	await reconcileGoalIds();
	process.exit(0);
}
