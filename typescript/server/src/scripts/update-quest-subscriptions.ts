/**
 * Re-sync quest subscriptions after quest definitions change.
 *
 * For each quest, calls `UpdateQuestSubscriptions`: unsubscribes every
 * subscriber and re-subscribes them against the current quest (refreshing goal
 * subs and progress), then sends a QUEST_CHANGED notification.
 *
 * Run after seed loads or goal-id reconciles when you want subscribers fully
 * migrated rather than relying on lazy repair on score import.
 *
 * Run:
 *   bun run src/scripts/update-quest-subscriptions.ts
 *   bun run src/scripts/update-quest-subscriptions.ts --dry-run
 *   bun run src/scripts/update-quest-subscriptions.ts --only-subscribed
 *   bun run src/scripts/update-quest-subscriptions.ts --game sdvx
 */

import { log } from "#lib/log/log";
import { UpdateQuestSubscriptions } from "#lib/targets/quests";
import DB from "#services/pg/db";
import { sql } from "kysely";
import { parseArgs } from "node:util";

const DEFAULT_BATCH_SIZE = 100;

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		"batch-size": { type: "string" },
		"dry-run": { type: "boolean" },
		game: { type: "string" },
		"only-subscribed": { type: "boolean" },
		help: { type: "boolean", short: "h" },
	},
});

if (values.help) {
	console.log(`
update-quest-subscriptions — run UpdateQuestSubscriptions for all quests

  --batch-size <n>   Quest ids per DB fetch (default ${DEFAULT_BATCH_SIZE})
  --only-subscribed  Only process quests with at least one quest_sub row
  --game <game>      Limit to a single game (v3 id, e.g. sdvx or iidx-sp)
  --dry-run          Log quests that would be updated without writing
  -h, --help         Show this help
`);
	process.exit(0);
}

const cliDryRun = values["dry-run"] ?? false;
const onlySubscribed = values["only-subscribed"] ?? false;
const gameFilter = values.game;
const batchSize = Math.max(
	1,
	Number.parseInt(values["batch-size"] ?? "", 10) || DEFAULT_BATCH_SIZE,
);

export async function updateAllQuestSubscriptions(options?: {
	batchSize?: number;
	dryRun?: boolean;
	game?: string;
	onlySubscribed?: boolean;
}) {
	const isDryRun = options?.dryRun ?? cliDryRun;
	const limit = options?.batchSize ?? batchSize;
	const game = options?.game ?? gameFilter;
	const subscribedOnly = options?.onlySubscribed ?? onlySubscribed;

	let processed = 0;
	let updated = 0;
	let skipped = 0;
	let subscribersNotified = 0;
	let afterId = "";

	log.info(
		`update-quest-subscriptions: starting (dry-run=${isDryRun}, only-subscribed=${subscribedOnly}${game ? `, game=${game}` : ""})`,
	);

	for (;;) {
		let query = DB.selectFrom("quest")
			.select(["quest.id", "quest.name"])
			.select((eb) =>
				eb
					.selectFrom("quest_sub")
					.select((eb2) => eb2.fn.countAll<string>().as("count"))
					.whereRef("quest_sub.quest_id", "=", "quest.id")
					.as("subscriber_count"),
			)
			.where("quest.id", ">", afterId)
			.orderBy("quest.id", "asc")
			.limit(limit);

		if (subscribedOnly) {
			query = query.where((eb) =>
				eb.exists(
					eb
						.selectFrom("quest_sub")
						.select(sql`1`.as("one"))
						.whereRef("quest_sub.quest_id", "=", "quest.id"),
				),
			);
		}

		if (game) {
			query = query.where("quest.game", "=", game as never);
		}

		const batch = await query.execute();

		if (batch.length === 0) {
			break;
		}

		for (const row of batch) {
			processed++;
			const subscriberCount = Number(row.subscriber_count ?? 0);

			if (subscriberCount === 0) {
				skipped++;
				continue;
			}

			if (isDryRun) {
				log.info(
					`[dry-run] Would update quest ${row.id} (${row.name}) — ${subscriberCount} subscriber(s)`,
				);
				updated++;
				subscribersNotified += subscriberCount;
				continue;
			}

			await UpdateQuestSubscriptions(row.id);
			updated++;
			subscribersNotified += subscriberCount;
			log.info(`Updated quest ${row.id} (${row.name}) — ${subscriberCount} subscriber(s)`);
		}

		afterId = batch[batch.length - 1]!.id;

		log.info(
			`update-quest-subscriptions: processed ${processed} quests (batch through ${afterId})`,
		);

		if (batch.length < limit) {
			break;
		}
	}

	log.info(
		`update-quest-subscriptions complete: ${processed} quest(s) scanned, ${updated} updated, ${skipped} skipped (no subscribers), ${subscribersNotified} subscriber notification(s).`,
	);

	return { processed, updated, skipped, subscribersNotified };
}

if (require.main === module) {
	await updateAllQuestSubscriptions();
	process.exit(0);
}
