import {
	LoadScoreDocumentsForImport,
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { log } from "#lib/log/log";
import { ProcessPBs } from "#lib/score-import/framework/pb/process-pbs";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { beforeEach, describe, expect, it } from "vitest";

import { DeleteMultipleScores } from "./delete-scores";

const chart = Testing511SPA;

async function seedIidx511Chart() {
	await DB.insertInto("song")
		.values({
			id: Testing511Song.id,
			legacy_id: 1,
			game_group: "iidx",
			title: Testing511Song.title,
			artist: Testing511Song.artist,
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
			data: Testing511Song.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

/**
 * Insert an iidx-sp score that is committed (visible to ProcessPBs / CreatePBDoc).
 */
async function insertCommittedIidxScore(opts: {
	chartId: string;
	importId?: string | null;
	scoreId: string;
	sessionId?: string | null;
	timeMs?: number;
	userId: number;
}) {
	const timeMs = opts.timeMs ?? Date.now();
	const doc = mkFakeScoreIIDXSP({
		userID: opts.userId,
		chartID: opts.chartId,
		scoreID: opts.scoreId,
		scoreData: TestingIIDXSPScore.scoreData,
		calculatedData: TestingIIDXSPScore.calculatedData,
		timeAchieved: timeMs,
		timeAdded: timeMs,
	});
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", doc.scoreData);
	const ts = UnixMillisecondsToISO8601(timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: opts.sessionId ?? null,
			import_id: opts.importId ?? null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(doc.calculatedData),
			meta: JSON.stringify(doc.scoreMeta),
			time_achieved: ts,
			time_added: ts,
			highlight: false,
			comment: null,
			committed: true,
		})
		.execute();
}

/**
 * Load a full ScoreDocument from Postgres by score ID.
 * Useful when you need to pass a score to DeleteMultipleScores but don't have an import_id.
 */
async function loadScoreDocById(scoreId: string) {
	const row = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("score.id", "=", scoreId)
		.executeTakeFirstOrThrow();
	return ToScoreDocument(row as ScoreDocumentJoinRow);
}

describe("DeleteMultipleScores", () => {
	beforeEach(seedIidx511Chart);

	it("deletes an empty session and relies on FK CASCADE for import_session (#82)", async () => {
		const { id: userId } = await seedUser({ username: "del_scores_sess_fk" });
		const chartId = chart.chartID;
		const importId = `del-scores-imp-${Date.now()}`;
		const sessionId = "sess-delete-scores-import-fk";
		const scoreId = "score_delete_scores_import_fk";
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "x",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		await DB.insertInto("import")
			.values({
				id: importId,
				user_id: userId,
				time_started: now,
				time_finished: now,
				game_group: "iidx",
				import_type: "file/batch-manual" as never,
				user_intent: true,
				service: "test",
				status: "completed",
			})
			.execute();

		await DB.insertInto("import_session")
			.values({
				import_id: importId,
				session_id: sessionId,
				type: "created",
			})
			.execute();

		const doc = mkFakeScoreIIDXSP({
			userID: userId,
			chartID: chartId,
			scoreID: scoreId,
		});
		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", doc.scoreData);
		const ts = UnixMillisecondsToISO8601(Date.now());

		await DB.insertInto("score")
			.values({
				id: scoreId,
				user_id: userId,
				chart_id: chartId,
				game: "iidx-sp",
				session_id: sessionId,
				import_id: importId,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: JSON.stringify(judgements),
				calculated_data: JSON.stringify({}),
				meta: JSON.stringify({}),
				time_achieved: ts,
				time_added: ts,
				highlight: false,
				comment: null,
			})
			.execute();

		const toDelete = await LoadScoreDocumentsForImport(importId);

		await DeleteMultipleScores(toDelete);

		const deletedScore = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", scoreId)
			.executeTakeFirst();

		expect(deletedScore).toBeUndefined();

		const sess = await DB.selectFrom("session")
			.select("id")
			.where("id", "=", sessionId)
			.executeTakeFirst();
		expect(sess).toBeUndefined();

		const link = await DB.selectFrom("import_session")
			.select("row_id")
			.where("session_id", "=", sessionId)
			.executeTakeFirst();
		expect(link).toBeUndefined();

		const importStill = await DB.selectFrom("import")
			.select("import.id")
			.where("import.id", "=", importId)
			.executeTakeFirst();
		expect(importStill).toEqual({ id: importId });
	});

	it("deletes the pb row when all scores on the chart are removed (#1521)", async () => {
		const { id: userId } = await seedUser({ username: "del_scores_pb_gone" });
		const chartId = chart.chartID;
		const scoreId = "score_del_pb_gone";

		await insertCommittedIidxScore({ userId, chartId, scoreId });

		// Establish the PB.
		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbBefore).toBeDefined();

		const scoreDoc = await loadScoreDocById(scoreId);
		await DeleteMultipleScores([scoreDoc]);

		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbAfter).toBeUndefined();
	});

	it("updates the pb to the best remaining score when only some scores are removed", async () => {
		const { id: userId } = await seedUser({ username: "del_scores_pb_update" });
		const chartId = chart.chartID;
		const keepScoreId = "score_del_pb_keep";
		const deleteScoreId = "score_del_pb_delete";

		// Both scores use the same scoreData; the later time_achieved one wins the PB.
		await insertCommittedIidxScore({ userId, chartId, scoreId: keepScoreId, timeMs: 1_000 });
		await insertCommittedIidxScore({ userId, chartId, scoreId: deleteScoreId, timeMs: 2_000 });

		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const deleteDoc = await loadScoreDocById(deleteScoreId);
		await DeleteMultipleScores([deleteDoc]);

		// PB should still exist and now be composed from the remaining score.
		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbAfter).toBeDefined();

		const composedFrom = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbAfter!.row_id)
			.execute();
		const composedScoreIds = composedFrom.map((r) => r.score_id);
		expect(composedScoreIds).toContain(keepScoreId);
		expect(composedScoreIds).not.toContain(deleteScoreId);
	});

	it("keeps the session alive and recalculates when only some of its scores are deleted", async () => {
		const { id: userId } = await seedUser({ username: "del_partial_session" });
		const chartId = chart.chartID;
		const importIdA = `del-partial-sess-a-${Date.now()}`;
		const importIdB = `del-partial-sess-b-${Date.now()}`;
		const sessionId = "sess-del-partial";
		const scoreIdA = "score_del_partial_a";
		const scoreIdB = "score_del_partial_b";
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "partial-revert-session",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		// Two separate imports both contributed scores to the same session.
		for (const importId of [importIdA, importIdB]) {
			await DB.insertInto("import")
				.values({
					id: importId,
					user_id: userId,
					time_started: now,
					time_finished: now,
					game_group: "iidx",
					import_type: "file/batch-manual" as never,
					user_intent: true,
					service: "test",
					status: "completed",
				})
				.execute();
		}

		await insertCommittedIidxScore({
			userId,
			chartId,
			scoreId: scoreIdA,
			importId: importIdA,
			sessionId,
		});
		await insertCommittedIidxScore({
			userId,
			chartId,
			scoreId: scoreIdB,
			importId: importIdB,
			sessionId,
		});

		// Delete only the scores belonging to importA.
		const toDelete = await LoadScoreDocumentsForImport(importIdA);
		await DeleteMultipleScores(toDelete);

		// importA's score must be gone.
		const deletedScore = await DB.selectFrom("score")
			.select("score.id")
			.where("score.id", "=", scoreIdA)
			.executeTakeFirst();
		expect(deletedScore, "importA score must be deleted").toBeUndefined();

		// importB's score must survive and retain its session link.
		const survivingScore = await DB.selectFrom("score")
			.select(["score.id", "score.session_id"])
			.where("score.id", "=", scoreIdB)
			.executeTakeFirst();
		expect(survivingScore, "importB score must survive").toBeDefined();
		expect(survivingScore!.session_id, "importB score must retain session link").toBe(
			sessionId,
		);

		// The shared session must survive because importB's score remains.
		const sessionRow = await DB.selectFrom("session")
			.select("session.id")
			.where("session.id", "=", sessionId)
			.executeTakeFirst();
		expect(sessionRow, "session must survive partial revert").toBeDefined();
	});

	it("correctly handles deleting multiple scores on the same chart in a single batch", async () => {
		const { id: userId } = await seedUser({ username: "del_dup_chart" });
		const chartId = chart.chartID;
		const scoreId1 = "score_del_dup_chart_1";
		const scoreId2 = "score_del_dup_chart_2";

		await insertCommittedIidxScore({ userId, chartId, scoreId: scoreId1, timeMs: 1_000 });
		await insertCommittedIidxScore({ userId, chartId, scoreId: scoreId2, timeMs: 2_000 });

		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbBefore, "PB must exist before the batch delete").toBeDefined();

		// Delete both scores in a single call — exercises the dedup path through ProcessPBs.
		const score1Doc = await loadScoreDocById(scoreId1);
		const score2Doc = await loadScoreDocById(scoreId2);
		await DeleteMultipleScores([score1Doc, score2Doc]);

		// All scores gone.
		const remaining = await DB.selectFrom("score")
			.select("score.id")
			.where("score.id", "in", [scoreId1, scoreId2])
			.execute();
		expect(remaining, "all scores must be deleted").toHaveLength(0);

		// Stale PB and its composed_from entries must be cleaned up.
		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbAfter, "stale PB must be deleted").toBeUndefined();

		const composedFrom = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.score_id", "in", [scoreId1, scoreId2])
			.execute();
		expect(composedFrom, "pb_composed_from entries must be gone").toHaveLength(0);
	});

	it("clears pb_dirty for the chart after deleting all scores", async () => {
		const { id: userId } = await seedUser({ username: "del_scores_pb_dirty" });
		const chartId = chart.chartID;
		const scoreId = "score_del_pb_dirty";

		await insertCommittedIidxScore({ userId, chartId, scoreId });
		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const scoreDoc = await loadScoreDocById(scoreId);
		await DeleteMultipleScores([scoreDoc]);

		// After a completed delete the dirty queue must be empty for this user/chart.
		const dirty = await DB.selectFrom("pb_dirty")
			.select("pb_dirty.chart_id")
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", chartId)
			.execute();
		expect(dirty).toHaveLength(0);
	});
});
