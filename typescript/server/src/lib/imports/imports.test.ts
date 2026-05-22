import { log } from "#lib/log/log";
import { ProcessPBs } from "#lib/score-import/framework/pb/process-pbs";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { mkFakeImport, mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { beforeEach, describe, expect, it } from "vitest";

import { RevertImport } from "./imports";

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

async function insertIidxScore(opts: {
	chartId: string;
	/** Set true when the score must be visible to ProcessPBs (score.committed). */
	committed?: boolean;
	importId: string | null;
	scoreId: string;
	sessionId: string | null;
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
			session_id: opts.sessionId,
			import_id: opts.importId,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify(doc.calculatedData),
			meta: JSON.stringify(doc.scoreMeta),
			time_achieved: ts,
			time_added: ts,
			highlight: false,
			comment: null,
			committed: opts.committed ?? false,
		})
		.execute();
}

async function insertImportRow(importId: string, userId: number) {
	const now = new Date().toISOString();
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

async function insertOrphanScore(opts: {
	importId: string | null;
	orphanId: string;
	userId: number;
}) {
	await DB.insertInto("orphan_score")
		.values({
			orphan_id: opts.orphanId,
			user_id: opts.userId,
			import_id: opts.importId,
			import_type: "file/batch-manual" as never,
			game_group: "iidx",
			data: JSON.stringify({}),
			context: JSON.stringify({}),
			time_inserted: new Date().toISOString(),
			error_message: "",
		})
		.execute();
}

describe("RevertImport", () => {
	beforeEach(seedIidx511Chart);

	it("deletes the import row and only scores linked by import_id", async () => {
		const { id: userId } = await seedUser({ username: "revert_import_u" });
		const chartId = chart.chartID;
		const importId = `revert-imp-${Date.now()}`;
		const now = new Date().toISOString();

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

		await insertIidxScore({ userId, scoreId: "score_1", chartId, importId, sessionId: null });
		await insertIidxScore({ userId, scoreId: "score_2", chartId, importId, sessionId: null });
		await insertIidxScore({
			userId,
			scoreId: "score_3",
			chartId,
			importId: null,
			sessionId: null,
		});

		const importDoc = mkFakeImport({
			importID: importId,
			userID: userId,
			scoreIDs: ["score_1", "score_2"],
		});

		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		const importRow = await DB.selectFrom("import")
			.select("id")
			.where("id", "=", importId)
			.executeTakeFirst();
		expect(importRow).toBeUndefined();

		const s1 = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", "score_1")
			.executeTakeFirst();
		const s2 = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", "score_2")
			.executeTakeFirst();
		const s3 = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", "score_3")
			.executeTakeFirst();

		expect(s1).toBeUndefined();
		expect(s2).toBeUndefined();
		expect(s3).toEqual({ id: "score_3" });
	});

	it("reverts an import whose session is linked in import_session (#82)", async () => {
		const { id: userId } = await seedUser({ username: "revert_import_session_fk" });
		const chartId = chart.chartID;
		const importId = `revert-imp-sess-${Date.now()}`;
		const sessionId = "sess-revert-import-session-fk";
		const scoreId = "score_revert_import_session_fk";
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "revert-me",
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

		await insertIidxScore({
			userId,
			scoreId,
			chartId,
			importId,
			sessionId,
		});

		const importDoc = mkFakeImport({
			importID: importId,
			userID: userId,
			scoreIDs: [scoreId],
		});

		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		const sess = await DB.selectFrom("session")
			.select("session.id")
			.where("session.id", "=", sessionId)
			.executeTakeFirst();
		expect(sess).toBeUndefined();

		const link = await DB.selectFrom("import_session")
			.select("import_session.row_id")
			.where("import_session.session_id", "=", sessionId)
			.executeTakeFirst();
		expect(link).toBeUndefined();

		const deletedScore = await DB.selectFrom("score")
			.select("id")
			.where("id", "=", scoreId)
			.executeTakeFirst();
		expect(deletedScore).toBeUndefined();

		const deletedImport = await DB.selectFrom("import")
			.select("import.id")
			.where("import.id", "=", importId)
			.executeTakeFirst();
		expect(deletedImport).toBeUndefined();
	});

	it("deletes the pb row when reverting an import that held the only score on a chart (#1521)", async () => {
		const { id: userId } = await seedUser({ username: "revert_pb_gone" });
		const chartId = chart.chartID;
		const importId = `revert-pb-gone-${Date.now()}`;
		const scoreId = "score_revert_pb_gone";

		await insertImportRow(importId, userId);
		await insertIidxScore({
			userId,
			scoreId,
			chartId,
			importId,
			sessionId: null,
			committed: true,
		});

		// Create the PB so there is something to linger if the bug is present.
		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbBefore, "PB should exist before revert").toBeDefined();

		const importDoc = mkFakeImport({ importID: importId, userID: userId, scoreIDs: [scoreId] });
		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbAfter, "stale PB must be deleted after revert").toBeUndefined();
	});

	it("updates the pb to the surviving score when reverting one of two imports on the same chart", async () => {
		const { id: userId } = await seedUser({ username: "revert_pb_update" });
		const chartId = chart.chartID;
		const importIdA = `revert-pb-update-a-${Date.now()}`;
		const importIdB = `revert-pb-update-b-${Date.now()}`;
		const scoreIdA = "score_revert_pb_update_a";
		const scoreIdB = "score_revert_pb_update_b";

		await insertImportRow(importIdA, userId);
		await insertImportRow(importIdB, userId);

		// Score A (import A) is older; score B (import B) is newer and wins the PB.
		await insertIidxScore({
			userId,
			scoreId: scoreIdA,
			chartId,
			importId: importIdA,
			sessionId: null,
			committed: true,
			timeMs: 1_000,
		});
		await insertIidxScore({
			userId,
			scoreId: scoreIdB,
			chartId,
			importId: importIdB,
			sessionId: null,
			committed: true,
			timeMs: 2_000,
		});

		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		// Revert only import B (the one that held the better score).
		const importDoc = mkFakeImport({
			importID: importIdB,
			userID: userId,
			scoreIDs: [scoreIdB],
		});
		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		// Score A still exists, so the PB should survive and now be composed from score A.
		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbAfter, "PB should still exist when another score remains").toBeDefined();

		const composedFrom = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbAfter!.row_id)
			.execute();
		const composedScoreIds = composedFrom.map((r) => r.score_id);
		expect(composedScoreIds).toContain(scoreIdA);
		expect(composedScoreIds).not.toContain(scoreIdB);
	});

	it("clears pb_dirty after reverting an import (no lingering queue entries)", async () => {
		const { id: userId } = await seedUser({ username: "revert_pb_dirty" });
		const chartId = chart.chartID;
		const importId = `revert-pb-dirty-${Date.now()}`;
		const scoreId = "score_revert_pb_dirty";

		await insertImportRow(importId, userId);
		await insertIidxScore({
			userId,
			scoreId,
			chartId,
			importId,
			sessionId: null,
			committed: true,
		});
		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const importDoc = mkFakeImport({ importID: importId, userID: userId, scoreIDs: [scoreId] });
		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		const dirty = await DB.selectFrom("pb_dirty")
			.select("pb_dirty.chart_id")
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", chartId)
			.execute();
		expect(dirty, "pb_dirty must be empty after revert").toHaveLength(0);
	});

	it("correctly reverts an import that has multiple scores on the same chart", async () => {
		const { id: userId } = await seedUser({ username: "revert_dup_chart" });
		const chartId = chart.chartID;
		const importId = `revert-dup-chart-${Date.now()}`;
		const scoreId1 = "score_revert_dup_chart_1";
		const scoreId2 = "score_revert_dup_chart_2";

		await insertImportRow(importId, userId);

		await insertIidxScore({
			userId,
			scoreId: scoreId1,
			chartId,
			importId,
			sessionId: null,
			committed: true,
			timeMs: 1_000,
		});
		await insertIidxScore({
			userId,
			scoreId: scoreId2,
			chartId,
			importId,
			sessionId: null,
			committed: true,
			timeMs: 2_000,
		});

		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbBefore, "PB must exist before revert").toBeDefined();

		const importDoc = mkFakeImport({
			importID: importId,
			userID: userId,
			scoreIDs: [scoreId1, scoreId2],
		});

		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		// Both scores deleted.
		const remaining = await DB.selectFrom("score")
			.select("score.id")
			.where("score.id", "in", [scoreId1, scoreId2])
			.execute();
		expect(remaining, "all scores in the import must be deleted").toHaveLength(0);

		// Import row gone.
		const importRow = await DB.selectFrom("import")
			.select("import.id")
			.where("import.id", "=", importId)
			.executeTakeFirst();
		expect(importRow, "import row must be deleted").toBeUndefined();

		// Stale PB cleaned up even though ProcessPBs is called twice for the same chart.
		const pbAfter = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirst();
		expect(pbAfter, "stale PB must be deleted after revert").toBeUndefined();

		// pb_composed_from entries must be gone.
		const composedFrom = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.score_id", "in", [scoreId1, scoreId2])
			.execute();
		expect(composedFrom, "pb_composed_from must be empty after revert").toHaveLength(0);
	});

	it("deletes orphan_score rows that belong to the reverted import", async () => {
		const { id: userId } = await seedUser({ username: "revert_orphans_deleted" });
		const importId = `revert-orphan-del-${Date.now()}`;

		await insertImportRow(importId, userId);

		// Two orphans tied to this import, one tied to a different import, one with no import.
		const otherImportId = `revert-orphan-other-${Date.now()}`;
		await insertImportRow(otherImportId, userId);

		await insertOrphanScore({ userId, orphanId: "orphan-del-1", importId });
		await insertOrphanScore({ userId, orphanId: "orphan-del-2", importId });
		await insertOrphanScore({ userId, orphanId: "orphan-del-other", importId: otherImportId });
		await insertOrphanScore({ userId, orphanId: "orphan-del-null", importId: null });

		const importDoc = mkFakeImport({ importID: importId, userID: userId, scoreIDs: [] });
		const err = await RevertImport(importDoc);
		expect(err).toBeNull();

		// The two orphans linked to the reverted import must be gone.
		const gone1 = await DB.selectFrom("orphan_score")
			.select("orphan_score.orphan_id")
			.where("orphan_score.orphan_id", "=", "orphan-del-1")
			.executeTakeFirst();
		const gone2 = await DB.selectFrom("orphan_score")
			.select("orphan_score.orphan_id")
			.where("orphan_score.orphan_id", "=", "orphan-del-2")
			.executeTakeFirst();
		expect(gone1, "orphan linked to reverted import must be deleted").toBeUndefined();
		expect(gone2, "orphan linked to reverted import must be deleted").toBeUndefined();

		// Orphans from a different import and null-import orphans must survive.
		const keptOther = await DB.selectFrom("orphan_score")
			.select("orphan_score.orphan_id")
			.where("orphan_score.orphan_id", "=", "orphan-del-other")
			.executeTakeFirst();
		const keptNull = await DB.selectFrom("orphan_score")
			.select("orphan_score.orphan_id")
			.where("orphan_score.orphan_id", "=", "orphan-del-null")
			.executeTakeFirst();
		expect(keptOther, "orphan from a different import must not be deleted").toBeDefined();
		expect(keptNull, "orphan with no import_id must not be deleted").toBeDefined();
	});

	it("cleans up pb_composed_from when reverting an import that owned the only score", async () => {
		const { id: userId } = await seedUser({ username: "revert_pb_composed" });
		const chartId = chart.chartID;
		const importId = `revert-pb-composed-${Date.now()}`;
		const scoreId = "score_revert_pb_composed";

		await insertImportRow(importId, userId);
		await insertIidxScore({
			userId,
			scoreId,
			chartId,
			importId,
			sessionId: null,
			committed: true,
		});
		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.executeTakeFirstOrThrow();

		const composedBefore = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbBefore.row_id)
			.execute();
		expect(composedBefore.length).toBeGreaterThan(0);

		const importDoc = mkFakeImport({ importID: importId, userID: userId, scoreIDs: [scoreId] });
		await RevertImport(importDoc);

		const composedAfter = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbBefore.row_id)
			.execute();
		expect(composedAfter, "pb_composed_from entries must be gone after revert").toHaveLength(0);
	});
});
