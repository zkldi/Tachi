import type { ChartDocument, integer, ScoreDocument } from "tachi-common";

import { log } from "#lib/log/log";
import { mongoScoreDocumentToNewScoreRow } from "#lib/score-import/framework/pg/mongo-score-to-pg";
import DB from "#services/pg/db";

const MAX_PIPELINE_LENGTH = 500;

interface PendingInsert {
	score: ScoreDocument;
	chartIdPg: string;
	committed: boolean;
	importId: string | null;
}

interface ScoreQueue {
	queue: Array<PendingInsert>;
	scoreIDSet: Set<string>;
}

const ScoreQueues: Record<integer, ScoreQueue> = {};

function GetOrSetScoreQueue(userID: integer) {
	const queue = ScoreQueues[userID];

	if (!queue) {
		return SetScoreQueue(userID);
	}

	return queue;
}

export function GetScoreQueueMaybe(userID: integer): ScoreQueue | undefined {
	return ScoreQueues[userID];
}

function SetScoreQueue(userID: integer) {
	const queue: ScoreQueue = {
		queue: [],
		scoreIDSet: new Set(),
	};

	ScoreQueues[userID] = queue;

	return queue;
}

function AddToScoreQueue(scoreQueue: ScoreQueue, item: PendingInsert) {
	scoreQueue.queue.push(item);
	scoreQueue.scoreIDSet.add(item.score.scoreID);
}

export async function InsertQueue(userID: integer) {
	const scoreQueue = GetOrSetScoreQueue(userID);

	const queued = scoreQueue.queue.splice(0);

	if (queued.length !== 0) {
		delete ScoreQueues[userID];

		try {
			const rows = queued.map((item) =>
				mongoScoreDocumentToNewScoreRow(item.score, item.chartIdPg, {
					committed: item.committed,
					importId: item.importId,
					sessionId: null,
				}),
			);

			await DB.insertInto("raw_score").values(rows).execute();
		} catch (err) {
			log.warn(
				{ err },
				`Triggered duplicate key protection. Race condition protected against, but this is not good.`,
			);
			return null;
		}
	}

	return queued.length;
}

/**
 * Adds a score to a queue to be inserted in batch to the database.
 * @returns True on success, The amount of scores inserted on auto-pipeline-flush, and null if
 * the score provided is already loaded.
 */
export function QueueScoreInsert(
	score: ScoreDocument,
	chart: ChartDocument,
	importId: string | null,
	committed: boolean,
) {
	const scoreQueue = GetOrSetScoreQueue(score.userID);

	if (scoreQueue.scoreIDSet.has(score.scoreID)) {
		log.debug(`Score ID ${score.scoreID} was already queued to be imported.`);
		return null;
	}

	AddToScoreQueue(scoreQueue, {
		score,
		chartIdPg: chart.chartID,
		committed,
		importId,
	});

	log.debug(`ScoreQueue for ${score.userID} is now at ${scoreQueue.queue.length}.`);

	if (scoreQueue.queue.length >= MAX_PIPELINE_LENGTH) {
		log.debug(`Triggered pipeline flush with len ${scoreQueue.queue.length}.`);
		return InsertQueue(score.userID);
	}

	return true;
}
