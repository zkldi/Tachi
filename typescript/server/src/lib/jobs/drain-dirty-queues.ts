import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { SELECT_SESSION_DOCUMENT } from "#lib/db-formats/session";
import { newCalculationRunStartedAt } from "#lib/dirty-queues/calculation-run";
import {
	claimGameProfileDirtyRows,
	claimPbDirtyRows,
	claimSessionDirtyRows,
} from "#lib/dirty-queues/claim-dirty-queue";
import { log } from "#lib/log/log";
import { CreateSessionCalcData } from "#lib/score-import/framework/calculated-data/session";
import { ProcessPBs } from "#lib/score-import/framework/pb/process-pbs";
import { rederiveScoresForChart } from "#lib/score-import/framework/pb/rederive-scores";
import { scoreVisibleSql } from "#lib/score-import/framework/pg/score-visibility";
import { UpdateUsersGamePlaytypeStats } from "#lib/score-import/framework/ugpt-stats/update-ugpt-stats";
import DB from "#services/pg/db";
import {
	type GameGroup,
	type integer,
	LEGACY_GameGroupPTToGame,
	LEGACY_GameToGameGroupPT,
	type LEGACY_Playtype,
	type V3Game,
} from "tachi-common";

const PB_DIRTY_BATCH = 5000;
const SCORE_REDERIVE_BATCH = 5000;
const SESSION_DIRTY_BATCH = 5000;
const GAME_PROFILE_DIRTY_BATCH = 500;

/** Number of charts to rederive concurrently inside one `drainScoreRederive` call. */
const PARALLEL_CHART_WORKERS = 4;

/** Per-queue row-processing caps for one cron tick. Each queue gets its own budget so a
 * large `score_rederive` backlog cannot starve `pb_dirty` / session / game_profile drains. */
const SCORE_REDERIVE_CAP = 50_000;
const PB_DIRTY_CAP = 100_000;
const SESSION_DIRTY_CAP = 50_000;
const GAME_PROFILE_DIRTY_CAP = 5_000;

/**
 * Drain the `pb_dirty` queue: claim rows with SKIP LOCKED, group by (game, playtype, user_id),
 * call ProcessPBs per group. Claiming deletes rows atomically so concurrent workers are safe.
 */
export async function drainPbDirty(): Promise<number> {
	const rows = await claimPbDirtyRows(PB_DIRTY_BATCH);

	if (rows.length === 0) {
		return 0;
	}

	const groups = new Map<
		string,
		{
			chartIDs: Set<string>;
			game: GameGroup;
			playtype: LEGACY_Playtype;
			runStartedAt: Awaited<ReturnType<typeof newCalculationRunStartedAt>>;
			userID: integer;
		}
	>();

	for (const row of rows) {
		const { gameGroup: game, playtype } = LEGACY_GameToGameGroupPT(row.chart_game as V3Game);
		const key = `${game}:${playtype}:${row.user_id}`;

		let group = groups.get(key);

		if (!group) {
			group = {
				game,
				playtype,
				userID: row.user_id,
				chartIDs: new Set(),
				runStartedAt: await newCalculationRunStartedAt(),
			};
			groups.set(key, group);
		}

		group.chartIDs.add(row.chart_id);
	}

	for (const group of groups.values()) {
		const v3Game = LEGACY_GameGroupPTToGame(group.game, group.playtype);
		// eslint-disable-next-line no-await-in-loop
		await ProcessPBs(v3Game, group.userID, group.chartIDs, log, {
			runStartedAt: group.runStartedAt,
		});
	}

	log.info(`Drained ${rows.length} pb_dirty entries across ${groups.size} user/game groups.`);

	return rows.length;
}

/**
 * Drain the `score_rederive` queue: for each chart, re-derive all scores,
 * then delete the queue entry. The score UPDATEs will fire `score_pb_dirty`
 * triggers, so PB recalculation happens automatically.
 *
 * Charts are processed PARALLEL_CHART_WORKERS at a time using a shared-iterator
 * pool so all workers stay busy regardless of per-chart score counts.
 */
export async function drainScoreRederive(): Promise<number> {
	const rows = await DB.selectFrom("score_rederive")
		.select(["score_rederive.chart_id"])
		.orderBy("score_rederive.enqueued_at", "asc")
		.limit(SCORE_REDERIVE_BATCH)
		.execute();

	if (rows.length === 0) {
		return 0;
	}

	let totalScores = 0;

	for (let i = 0; i < rows.length; i += PARALLEL_CHART_WORKERS) {
		const chunk = rows.slice(i, i + PARALLEL_CHART_WORKERS);

		// eslint-disable-next-line no-await-in-loop
		const counts = await Promise.all(
			chunk.map(async (row) => {
				const updated = await rederiveScoresForChart(row.chart_id, log);

				await DB.deleteFrom("score_rederive")
					.where("score_rederive.chart_id", "=", row.chart_id)
					.execute();

				return updated;
			}),
		);

		for (const c of counts) {
			totalScores += c;
		}
	}

	log.debug(
		`Drained ${rows.length} score_rederive entries, re-derived ${totalScores} total scores.`,
	);

	return rows.length;
}

/**
 * Drain `session_dirty`: claim rows with SKIP LOCKED, recompute `session.calculated_data`.
 */
export async function drainSessionDirty(): Promise<number> {
	const rows = await claimSessionDirtyRows(SESSION_DIRTY_BATCH);

	if (rows.length === 0) {
		return 0;
	}

	for (const row of rows) {
		const sessionId = row.session_id;
		const runStartedAt = await newCalculationRunStartedAt();

		// eslint-disable-next-line no-await-in-loop
		const scoreRows = await DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.leftJoin("import", "import.id", "score.import_id")
			.select(SELECT_SCORE_DOCUMENT)
			.where("score.session_id", "=", sessionId)
			.where(scoreVisibleSql())
			.execute();

		if (scoreRows.length === 0) {
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const sessionRow = await DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("session.id", "=", sessionId)
			.executeTakeFirst();

		if (!sessionRow) {
			continue;
		}

		const scoreDocs = scoreRows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow));
		const calculatedData = CreateSessionCalcData(sessionRow.game as V3Game, scoreDocs);

		// eslint-disable-next-line no-await-in-loop
		await DB.updateTable("session")
			.set({
				calculated_data: JSON.stringify(calculatedData),
				last_clean_started_at: runStartedAt,
			})
			.where("session.id", "=", sessionId)
			.where("session.last_clean_started_at", "<=", runStartedAt)
			.execute();
	}

	log.info(`Drained ${rows.length} session_dirty entries.`);

	return rows.length;
}

/**
 * Drain `game_profile_dirty`: claim rows with SKIP LOCKED, recompute ratings/classes.
 */
export async function drainGameProfileDirty(): Promise<number> {
	const rows = await claimGameProfileDirtyRows(GAME_PROFILE_DIRTY_BATCH);

	if (rows.length === 0) {
		return 0;
	}

	for (const row of rows) {
		const userId = row.user_id;
		const runStartedAt = await newCalculationRunStartedAt();

		// eslint-disable-next-line no-await-in-loop
		await UpdateUsersGamePlaytypeStats(row.game as V3Game, userId, null, log, {
			runStartedAt,
		});
	}

	log.info(`Drained ${rows.length} game_profile_dirty entries.`);

	return rows.length;
}

/**
 * Drain `game_profile_dirty` until empty (no per-tick row cap). For admin synchronous
 * profile recalculation.
 */
export async function drainGameProfileDirtyFully(): Promise<void> {
	while (true) {
		const n = await drainGameProfileDirty();

		if (n === 0) {
			break;
		}
	}
}

/**
 * Drain `score_rederive`, then `pb_dirty`, then `session_dirty`, then `game_profile_dirty`,
 * repeating until a full pass does nothing. Each queue has its own per-tick row budget so
 * a large `score_rederive` backlog cannot permanently starve the downstream queues.
 * PBs must run before game profiles (ratings read from `pb`).
 */
export async function drainStatsQueuesInOrder(): Promise<void> {
	const tickStart = Date.now();

	const queueSizes = await Promise.all([
		DB.selectFrom("score_rederive")
			.select((eb) => eb.fn.countAll<string>().as("n"))
			.executeTakeFirst(),
		DB.selectFrom("pb_dirty")
			.select((eb) => eb.fn.countAll<string>().as("n"))
			.executeTakeFirst(),
		DB.selectFrom("session_dirty")
			.select((eb) => eb.fn.countAll<string>().as("n"))
			.executeTakeFirst(),
		DB.selectFrom("game_profile_dirty")
			.select((eb) => eb.fn.countAll<string>().as("n"))
			.executeTakeFirst(),
	]);

	log.info(
		{
			score_rederive: Number(queueSizes[0]?.n ?? 0),
			pb_dirty: Number(queueSizes[1]?.n ?? 0),
			session_dirty: Number(queueSizes[2]?.n ?? 0),
			game_profile_dirty: Number(queueSizes[3]?.n ?? 0),
		},
		"drainStatsQueuesInOrder: queue sizes at tick start",
	);

	while (true) {
		let cycleMoved = 0;

		let srProcessed = 0;

		while (srProcessed < SCORE_REDERIVE_CAP) {
			// eslint-disable-next-line no-await-in-loop
			const n = await drainScoreRederive();

			if (n === 0) {
				break;
			}

			srProcessed += n;
			cycleMoved += n;
		}

		let pbProcessed = 0;

		while (pbProcessed < PB_DIRTY_CAP) {
			// eslint-disable-next-line no-await-in-loop
			const n = await drainPbDirty();

			if (n === 0) {
				break;
			}

			pbProcessed += n;
			cycleMoved += n;
		}

		let sessionProcessed = 0;

		while (sessionProcessed < SESSION_DIRTY_CAP) {
			// eslint-disable-next-line no-await-in-loop
			const n = await drainSessionDirty();

			if (n === 0) {
				break;
			}

			sessionProcessed += n;
			cycleMoved += n;
		}

		let gpProcessed = 0;

		while (gpProcessed < GAME_PROFILE_DIRTY_CAP) {
			// eslint-disable-next-line no-await-in-loop
			const n = await drainGameProfileDirty();

			if (n === 0) {
				break;
			}

			gpProcessed += n;
			cycleMoved += n;
		}

		if (cycleMoved === 0) {
			break;
		}
	}

	const elapsedMs = Date.now() - tickStart;

	log.info({ elapsedMs }, "drainStatsQueuesInOrder: tick complete");
}

/**
 * Drain `score_rederive`, then `pb_dirty`, `session_dirty`, and `game_profile_dirty`,
 * repeating until a full pass moves nothing. No per-tick row cap (unlike the cron
 * drain) - intended for admin synchronous recalc.
 */
export async function drainStatsQueuesFully(): Promise<void> {
	while (true) {
		let cycleMoved = 0;

		while (true) {
			const n = await drainScoreRederive();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		while (true) {
			const n = await drainPbDirty();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		while (true) {
			const n = await drainSessionDirty();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		while (true) {
			const n = await drainGameProfileDirty();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		if (cycleMoved === 0) {
			break;
		}
	}
}

/**
 * Drain `pb_dirty` then `session_dirty` and `game_profile_dirty`, repeating until
 * idle. No per-tick row cap - intended for admin synchronous PB recalc.
 */
export async function drainPbDirtyAndDownstream(): Promise<void> {
	while (true) {
		let cycleMoved = 0;

		while (true) {
			const n = await drainPbDirty();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		while (true) {
			const n = await drainSessionDirty();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		while (true) {
			const n = await drainGameProfileDirty();

			if (n === 0) {
				break;
			}

			cycleMoved += n;
		}

		if (cycleMoved === 0) {
			break;
		}
	}
}

/**
 * Delete `pb_dirty` rows for the given user + chart IDs. Call this after
 * a synchronous `ProcessPBs` to prevent the async worker from redundantly
 * reprocessing the same pairs.
 */
export async function clearPbDirtyForUser(
	userID: integer,
	chartIDs: Iterable<string>,
): Promise<void> {
	const ids = [...chartIDs];

	if (ids.length === 0) {
		return;
	}

	await DB.deleteFrom("pb_dirty")
		.where("pb_dirty.user_id", "=", userID)
		.where("pb_dirty.chart_id", "in", ids)
		.execute();
}
