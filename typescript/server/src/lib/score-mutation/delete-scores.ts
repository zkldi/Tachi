import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { SELECT_SESSION_DOCUMENT } from "#lib/db-formats/session";
import { clearPbDirtyForUser } from "#lib/jobs/drain-dirty-queues";
import { log } from "#lib/log/log";
import { CreateSessionCalcData } from "#lib/score-import/framework/calculated-data/session";
import { GetAndUpdateUsersGoals } from "#lib/score-import/framework/goals/goals";
import { ProcessPBs } from "#lib/score-import/framework/pb/process-pbs";
import { UpdateUsersQuests } from "#lib/score-import/framework/quests/quests";
import { UpdateUsersGamePlaytypeStats } from "#lib/score-import/framework/ugpt-stats/update-ugpt-stats";
import DB from "#services/pg/db";
import { type ScoreDocument } from "tachi-common";
/* eslint-disable no-await-in-loop */

export function DeleteScore(score: ScoreDocument, blacklist = false): Promise<void> {
	return DeleteMultipleScores([score], blacklist);
}

export async function DeleteMultipleScores(
	scores: Array<ScoreDocument>,
	blacklist = false,
): Promise<void> {
	if (scores.length === 0) {
		return;
	}

	log.info(
		`Received request to delete ${scores.length} score(s) from Postgres (Blacklist: ${blacklist}).`,
	);

	const scoreIDs = scores.map((e) => e.scoreID);
	const chartIDs = scores.map((e) => e.chartID);

	const sessionLinks = await DB.selectFrom("raw_score as score")
		.select("session_id")
		.where("id", "in", scoreIDs)
		.execute();

	const sessionIds = [
		...new Set(
			sessionLinks
				.map((r) => r.session_id)
				.filter((id): id is string => id !== null && id !== undefined),
		),
	];

	await DB.deleteFrom("pb_composed_from").where("score_id", "in", scoreIDs).execute();

	await DB.deleteFrom("raw_score").where("id", "in", scoreIDs).execute();

	for (const sessionId of sessionIds) {
		const remainingRows = await DB.selectFrom("raw_score as score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.leftJoin("import", "import.id", "score.import_id")
			.select(SELECT_SCORE_DOCUMENT)
			.where("score.session_id", "=", sessionId)
			.execute();

		if (remainingRows.length === 0) {
			await DB.deleteFrom("session").where("id", "=", sessionId).execute();
		} else {
			const sessionRow = await DB.selectFrom("session")
				.select(SELECT_SESSION_DOCUMENT)
				.where("session.id", "=", sessionId)
				.executeTakeFirst();

			if (!sessionRow) {
				continue;
			}

			const scoreDocs = remainingRows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow));
			const calculatedData = CreateSessionCalcData(sessionRow.game, scoreDocs);

			await DB.updateTable("session")
				.set({
					calculated_data: JSON.stringify(calculatedData),
				})
				.where("id", "=", sessionId)
				.execute();
		}
	}

	for (const score of scores) {
		const v3Game = score.game;
		await ProcessPBs(v3Game, score.userID, new Set([score.chartID]), log);
		await clearPbDirtyForUser(score.userID, [score.chartID]);

		if (blacklist) {
			const alreadyBlacklisted = await DB.selectFrom("score_blacklist")
				.select("row_id")
				.where("user_id", "=", score.userID)
				.where("score_id", "=", score.scoreID)
				.executeTakeFirst();

			if (!alreadyBlacklisted) {
				log.info(`Blacklisted ${score.scoreID}.`);
				await DB.insertInto("score_blacklist")
					.values({
						user_id: score.userID,
						score_id: score.scoreID,
					})
					.execute();
			}
		}
	}

	const userGamePairs = [
		...new Map(scores.map((s) => [`${s.game}\x1f${s.userID}`, s] as const)).values(),
	];

	for (const sample of userGamePairs) {
		const game = sample.game;
		const userID = sample.userID;

		const pertinentChartIDs = scores
			.filter((e) => e.game === game && e.userID === userID)
			.map((e) => e.chartID);

		if (pertinentChartIDs.length > 0) {
			const goalInfo = await GetAndUpdateUsersGoals(
				game,
				userID,
				new Set(pertinentChartIDs),
				log,
			);

			await UpdateUsersQuests(goalInfo, game, userID, log);
		}

		await UpdateUsersGamePlaytypeStats(game, userID, null, log);
	}

	log.info(`Finished deleting ${scores.length} scores (Postgres).`);
}
