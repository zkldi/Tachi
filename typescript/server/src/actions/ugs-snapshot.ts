import type { Game } from "tachi-db";

/* eslint-disable no-await-in-loop */
import { MakeAction } from "#lib/actions/actions";
import { SELECT_GAME_PROFILE, ToGameStatsDocument } from "#lib/db-formats/game-profiles";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { GetMillisecondsSince } from "#utils/misc";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { GetAllRankings, GetUserGamePlaycount, IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";

const PROFILE_BATCH = 500;
const INSERT_BATCH = 500;

function snapshotTimestampUtcMidnight(): string {
	const ms = new Date().setUTCHours(0, 0, 0, 0);
	return UnixMillisecondsToISO8601(ms);
}

/**
 * Snapshots every {@link game_profile} row into {@link game_stats_snapshot} for UTC midnight
 * of the current run. Intended for the daily job runner; also exposed as {@link ACTION_UGSSnapshot}.
 */
export async function runUgsSnapshotCore() {
	const timeStart = process.hrtime.bigint();
	const snapshotTimestampIso = snapshotTimestampUtcMidnight();

	const dupe = await DB.selectFrom("game_stats_snapshot")
		.select("user_id")
		.where("timestamp", "=", snapshotTimestampIso)
		.executeTakeFirst();

	if (dupe) {
		const msg = `There already exist snapshots at this time. Has this job been run twice on one day? Ignoring request.`;
		log.warn(msg);
		throw new ExpectedErr(409, msg);
	}

	log.info(`Snapshotting game_profile → game_stats_snapshot.`);

	let insertBatch: Array<{
		classes: string;
		game: Game;
		playcount: number;
		rankings: string;
		ratings: string;
		timestamp: string;
		user_id: number;
	}> = [];

	const flush = async () => {
		if (insertBatch.length === 0) {
			return;
		}

		await DB.insertInto("game_stats_snapshot").values(insertBatch).execute();
		insertBatch = [];
	};

	try {
		let cursor: { game: Game; user_id: number } | undefined;

		while (true) {
			const cursorAtStart = cursor;

			let q = DB.selectFrom("game_profile")
				.select(SELECT_GAME_PROFILE)
				.orderBy("user_id", "asc")
				.orderBy("game", "asc")
				.limit(PROFILE_BATCH);

			if (cursorAtStart) {
				q = q.where((eb) =>
					eb.or([
						eb("user_id", ">", cursorAtStart.user_id),
						eb.and([
							eb("user_id", "=", cursorAtStart.user_id),
							eb("game", ">", cursorAtStart.game),
						]),
					]),
				);
			}

			const rows = await q.execute();

			if (rows.length === 0) {
				break;
			}

			for (const row of rows) {
				const stats = ToGameStatsDocument(row);

				log.debug(`Snapshotting ${stats.userID} ${stats.game}.`);

				const [playcount, rankings] = await Promise.all([
					GetUserGamePlaycount(stats.userID, stats.game),
					GetAllRankings(stats),
				]);

				insertBatch.push({
					classes: JSON.stringify(stats.classes),
					game: row.game,
					playcount,
					rankings: JSON.stringify(rankings),
					ratings: JSON.stringify(stats.ratings),
					timestamp: snapshotTimestampIso,
					user_id: stats.userID,
				});

				if (insertBatch.length >= INSERT_BATCH) {
					log.debug(`Flushed batch.`);
					await flush();
				}
			}

			const last = rows[rows.length - 1]!;
			cursor = { game: last.game, user_id: last.user_id };
		}

		await flush();

		log.info(
			`Successfully snapshotted all data as of ${snapshotTimestampIso}. Took ${GetMillisecondsSince(timeStart)} ms.`,
		);
	} catch (err) {
		log.error({ err }, `FATAL IN UGS-SNAPSHOT - Possibly failed midway through snapshotting.`);

		log.info(`Removing all snapshots at this timestamp (${snapshotTimestampIso}).`);

		await DB.deleteFrom("game_stats_snapshot")
			.where("timestamp", "=", snapshotTimestampIso)
			.execute();

		log.info(`Removed.`);

		throw err;
	}
}

export const ACTION_UGSSnapshot = MakeAction("UGS_SNAPSHOT", async (taker, _input) => {
	if (!(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorized to perform this action.");
	}

	await runUgsSnapshotCore();
	return {};
});
