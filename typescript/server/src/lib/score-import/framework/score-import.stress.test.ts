import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import { RevertImport } from "#lib/imports/imports";
import { RunScoreImportOnce } from "#lib/score-import/worker/run-score-import";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Aggressive stress / abuse tests for the score import engine.
 *
 * Goal: shake the pipeline as hard as we reasonably can in a single test process,
 * and codify the edge-case behaviours we currently rely on so future changes
 * have a clear regression net.
 *
 * Each test seeds a fresh user and chart (truncate-between-tests is provided by
 * the global vitest setup), then drives `RunScoreImportOnce` with crafted
 * batch-manual / direct-manual payloads.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

async function seed511Chart() {
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
			id: Testing511SPA.chartID,
			legacy_id: Testing511SPA.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: Testing511SPA.difficulty,
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: Testing511SPA.data,
		})
		.execute();
}

interface IidxScoreLine {
	difficulty?: string;
	identifier?: string;
	lamp?: string;
	score: number;
	timeAchieved?: number | null;
}

function iidxScore(opts: IidxScoreLine) {
	const out: Record<string, unknown> = {
		score: opts.score,
		lamp: opts.lamp ?? "HARD CLEAR",
		matchType: "songTitle",
		identifier: opts.identifier ?? Testing511Song.title,
		difficulty: opts.difficulty ?? Testing511SPA.difficulty,
	};

	if (opts.timeAchieved !== undefined) {
		out.timeAchieved = opts.timeAchieved;
	}

	return out;
}

function buildBatch(scores: Array<ReturnType<typeof iidxScore>>) {
	return {
		meta: { game: "iidx", playtype: "SP", service: "stress-test" },
		scores,
	};
}

describe("score import engine — stress / abuse", () => {
	beforeEach(async () => {
		await seedUser({
			username: "stress_u",
			email: "stress@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seed511Chart();
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Dedup / idempotency
	// ────────────────────────────────────────────────────────────────────────────

	it("dedups two identical scores submitted in the same batch", async () => {
		const batch = buildBatch([iidxScore({ score: 500 }), iidxScore({ score: 500 })]);

		const result = await RunScoreImportOnce({
			importID: "stress-dup-in-batch",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs).toHaveLength(1);
		expect(result.importDoc.errors).toHaveLength(0);

		const scoreCount = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<string>().as("c"))
			.where("score.import_id", "=", "stress-dup-in-batch")
			.executeTakeFirst();
		expect(Number(scoreCount?.c ?? 0)).toBe(1);
	});

	it("re-importing the exact same payload produces zero new scoreIDs", async () => {
		const batch = buildBatch([iidxScore({ score: 600, timeAchieved: 1_700_000_000_000 })]);

		const r1 = await RunScoreImportOnce({
			importID: "stress-reimport-1",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});
		expect(r1.kind).toBe("done");
		if (r1.kind !== "done") {
			return;
		}
		expect(r1.importDoc.scoreIDs).toHaveLength(1);

		const r2 = await RunScoreImportOnce({
			importID: "stress-reimport-2",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});
		expect(r2.kind).toBe("done");
		if (r2.kind !== "done") {
			return;
		}

		expect(
			r2.importDoc.scoreIDs,
			"second import of identical data must add no new scores",
		).toHaveLength(0);
		expect(r2.importDoc.errors, "duplicate skips must not surface as errors").toHaveLength(0);
		expect(r2.importDoc.createdSessions).toHaveLength(0);
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Lock / concurrency
	// ────────────────────────────────────────────────────────────────────────────

	it("two concurrent imports for the same user — exactly one wins, one returns lock_held", async () => {
		const batch = buildBatch([iidxScore({ score: 700 })]);

		const [r1, r2] = await Promise.all([
			RunScoreImportOnce({
				importID: "stress-concurrent-same-1",
				importType: "ir/direct-manual",
				parserArguments: [batch, false],
				userID: 1,
				userIntent: true,
			}),
			RunScoreImportOnce({
				importID: "stress-concurrent-same-2",
				importType: "ir/direct-manual",
				parserArguments: [batch, false],
				userID: 1,
				userIntent: true,
			}),
		]);

		const kinds = [r1.kind, r2.kind].sort();
		expect(kinds).toEqual(["done", "lock_held"]);

		// The winner should have actually committed a score; the loser must not have
		// touched the import_lock state on its own (lock should be free again now).
		const lockRow = await DB.selectFrom("import_lock")
			.select(["import_lock.locked"])
			.where("import_lock.user_id", "=", 1)
			.executeTakeFirstOrThrow();
		expect(lockRow.locked, "lock must be released after both calls return").toBe(false);
	});

	it("concurrent imports for two different users do not contend on the per-user lock", async () => {
		const second = await seedUser({
			username: "stress_u2",
			email: "stress2@example.com",
			withCredential: true,
			withSettings: true,
		});

		const batch1 = buildBatch([iidxScore({ score: 100 })]);
		const batch2 = buildBatch([iidxScore({ score: 200 })]);

		const [r1, r2] = await Promise.all([
			RunScoreImportOnce({
				importID: "stress-concurrent-diff-1",
				importType: "ir/direct-manual",
				parserArguments: [batch1, false],
				userID: 1,
				userIntent: true,
			}),
			RunScoreImportOnce({
				importID: "stress-concurrent-diff-2",
				importType: "ir/direct-manual",
				parserArguments: [batch2, false],
				userID: second.id,
				userIntent: true,
			}),
		]);

		expect(r1.kind, "user 1 must complete").toBe("done");
		expect(r2.kind, "user 2 must complete").toBe("done");
		if (r1.kind !== "done" || r2.kind !== "done") {
			return;
		}

		expect(r1.importDoc.userID).toBe(1);
		expect(r2.importDoc.userID).toBe(second.id);
		expect(r1.importDoc.scoreIDs).toHaveLength(1);
		expect(r2.importDoc.scoreIDs).toHaveLength(1);

		// Distinct scoreIDs — different users hash differently even on the same chart/metrics.
		expect(r1.importDoc.scoreIDs[0]).not.toBe(r2.importDoc.scoreIDs[0]);
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Pathological inputs
	// ────────────────────────────────────────────────────────────────────────────

	it("empty scores array completes successfully with no scoreIDs / errors / sessions", async () => {
		const result = await RunScoreImportOnce({
			importID: "stress-empty",
			importType: "ir/direct-manual",
			parserArguments: [buildBatch([]), false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs).toHaveLength(0);
		expect(result.importDoc.errors).toHaveLength(0);
		expect(result.importDoc.createdSessions).toHaveLength(0);

		// The import row itself must still exist in completed state.
		const dbDoc = await LoadImportDocumentById("stress-empty");
		expect(dbDoc).toBeDefined();
	});

	it("an import containing only an unknown song produces a SongOrChartNotFound error and an orphan_score row", async () => {
		const batch = buildBatch([
			iidxScore({ score: 800, identifier: "definitely_not_a_real_song_xyz" }),
		]);

		const result = await RunScoreImportOnce({
			importID: "stress-orphan-only",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs, "orphan score must not be in scoreIDs").toHaveLength(0);
		expect(result.importDoc.errors).toHaveLength(1);
		expect(result.importDoc.errors[0]?.type).toBe("SongOrChartNotFound");

		const orphans = await DB.selectFrom("orphan_score")
			.select(["orphan_score.orphan_id", "orphan_score.import_id"])
			.where("orphan_score.user_id", "=", 1)
			.execute();
		expect(orphans, "exactly one orphan_score row must be created").toHaveLength(1);
		expect(orphans[0]?.import_id).toBe("stress-orphan-only");
	});

	it("mixed valid + orphan scores in one batch produce partial success", async () => {
		const batch = buildBatch([
			iidxScore({ score: 900 }),
			iidxScore({ score: 901, identifier: "no_such_song_for_orphan_path" }),
		]);

		const result = await RunScoreImportOnce({
			importID: "stress-mixed",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs, "valid score must commit").toHaveLength(1);
		expect(result.importDoc.errors, "orphan must surface as one error").toHaveLength(1);
		expect(result.importDoc.errors[0]?.type).toBe("SongOrChartNotFound");

		const committedCount = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<string>().as("c"))
			.where("score.import_id", "=", "stress-mixed")
			.where("score.committed", "=", true)
			.executeTakeFirst();
		expect(Number(committedCount?.c ?? 0)).toBe(1);
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Sessions
	// ────────────────────────────────────────────────────────────────────────────

	it("scores with timeAchieved=null import successfully but produce no session", async () => {
		const batch = buildBatch([iidxScore({ score: 1000, timeAchieved: null })]);

		const result = await RunScoreImportOnce({
			importID: "stress-no-time",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs).toHaveLength(1);
		expect(
			result.importDoc.createdSessions,
			"timeAchieved=null must not create a session",
		).toHaveLength(0);

		const scoreRow = await DB.selectFrom("score")
			.select(["score.id", "score.session_id"])
			.where("score.import_id", "=", "stress-no-time")
			.executeTakeFirstOrThrow();
		expect(scoreRow.session_id, "score must have null session_id").toBeNull();
	});

	it("two scores >2h apart in the same import create two distinct sessions", async () => {
		const baseMs = Date.UTC(2024, 5, 1, 12, 0, 0, 0);
		const batch = buildBatch([
			iidxScore({ score: 1100, timeAchieved: baseMs }),
			iidxScore({ score: 1200, timeAchieved: baseMs + 6 * ONE_HOUR_MS }),
		]);

		const result = await RunScoreImportOnce({
			importID: "stress-multi-session",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs).toHaveLength(2);
		expect(
			result.importDoc.createdSessions,
			"two-group split must produce two sessions",
		).toHaveLength(2);

		// Each created session should be linked through `import_session` exactly once.
		const importSessions = await DB.selectFrom("import_session")
			.select(["import_session.session_id", "import_session.type"])
			.where("import_session.import_id", "=", "stress-multi-session")
			.execute();
		expect(importSessions).toHaveLength(2);
		expect(new Set(importSessions.map((r) => r.session_id)).size).toBe(2);

		// Both scores must end up linked to a (different) session.
		const scores = await DB.selectFrom("score")
			.select(["score.id", "score.session_id"])
			.where("score.import_id", "=", "stress-multi-session")
			.execute();
		expect(scores).toHaveLength(2);
		const sessionIds = scores.map((s) => s.session_id);
		expect(sessionIds.every((s) => s !== null)).toBe(true);
		expect(new Set(sessionIds).size, "scores must land in different sessions").toBe(2);
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Boundary inputs we have explicit code for — verify they actually behave.
	// ────────────────────────────────────────────────────────────────────────────

	it("timeAchieved: 0 is treated as null (no session created, score still imports)", async () => {
		// Documented backwards-compat behaviour in batch-manual converter.
		const batch = buildBatch([iidxScore({ score: 1400, timeAchieved: 0 })]);

		const result = await RunScoreImportOnce({
			importID: "stress-time-zero",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}

		expect(result.importDoc.scoreIDs).toHaveLength(1);
		expect(
			result.importDoc.createdSessions,
			"timeAchieved=0 must be treated as null and produce no session",
		).toHaveLength(0);

		const scoreRow = await DB.selectFrom("score")
			.select(["score.session_id", "score.time_achieved"])
			.where("score.import_id", "=", "stress-time-zero")
			.executeTakeFirstOrThrow();

		expect(scoreRow.session_id).toBeNull();
		expect(scoreRow.time_achieved, "score.time_achieved must be NULL in DB").toBeNull();
	});

	it("timeAchieved more than 24h in the future is rejected per-score with InvalidDatapoint", async () => {
		const farFutureMs = Date.now() + 48 * ONE_HOUR_MS;

		const batch = buildBatch([
			iidxScore({ score: 1500, timeAchieved: farFutureMs }),
			iidxScore({ score: 600, timeAchieved: 1_700_000_000_000 }),
		]);

		const result = await RunScoreImportOnce({
			importID: "stress-future-ts",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});

		// We expect a per-score validation error, not a fatal parse error.
		expect(result.kind, `expected "done" with per-score errors but got ${result.kind}`).toBe(
			"done",
		);
		if (result.kind !== "done") {
			return;
		}

		// The valid score must still commit.
		expect(result.importDoc.scoreIDs).toHaveLength(1);
		// The future-dated score must surface as a per-score error.
		expect(result.importDoc.errors).toHaveLength(1);
		expect(result.importDoc.errors[0]?.type).toBe("InvalidDatapoint");
		expect(result.importDoc.errors[0]?.message).toMatch(/future/iu);
	});

	it("re-importing the same orphan produces an OrphanExists error (no new orphan_score row)", async () => {
		const orphanScore = iidxScore({
			score: 700,
			identifier: "song_that_does_not_exist_for_orphan_dedup",
			timeAchieved: 1_700_000_000_000,
		});

		const r1 = await RunScoreImportOnce({
			importID: "stress-orphan-1",
			importType: "ir/direct-manual",
			parserArguments: [buildBatch([orphanScore]), false],
			userID: 1,
			userIntent: true,
		});
		expect(r1.kind).toBe("done");
		if (r1.kind !== "done") {
			return;
		}
		expect(r1.importDoc.errors).toHaveLength(1);
		expect(r1.importDoc.errors[0]?.type).toBe("SongOrChartNotFound");

		const orphansAfterFirst = await DB.selectFrom("orphan_score")
			.select(["orphan_score.orphan_id"])
			.where("orphan_score.user_id", "=", 1)
			.execute();
		expect(orphansAfterFirst).toHaveLength(1);

		const r2 = await RunScoreImportOnce({
			importID: "stress-orphan-2",
			importType: "ir/direct-manual",
			parserArguments: [buildBatch([orphanScore]), false],
			userID: 1,
			userIntent: true,
		});
		expect(r2.kind).toBe("done");
		if (r2.kind !== "done") {
			return;
		}

		expect(r2.importDoc.errors).toHaveLength(1);
		expect(
			r2.importDoc.errors[0]?.type,
			"second submission of an existing orphan must report OrphanExists",
		).toBe("OrphanExists");

		const orphansAfterSecond = await DB.selectFrom("orphan_score")
			.select(["orphan_score.orphan_id"])
			.where("orphan_score.user_id", "=", 1)
			.execute();
		expect(orphansAfterSecond, "no new orphan_score row must be created").toHaveLength(1);
		expect(orphansAfterSecond[0]?.orphan_id).toBe(orphansAfterFirst[0]?.orphan_id);
	});

	it("a stale import_lock older than one hour is auto-released so the next import can proceed", async () => {
		// Production behaviour: if a lock has been held >1h we silently free it.
		// This test pins that down — surprising but documented in lock.ts.
		const ninetyMinutesAgoMs = Date.now() - 90 * 60 * 1000;

		await DB.insertInto("import_lock")
			.values({
				user_id: 1,
				locked: true,
				locked_at: new Date(ninetyMinutesAgoMs).toISOString(),
			})
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({
					locked: true,
					locked_at: new Date(ninetyMinutesAgoMs).toISOString(),
				}),
			)
			.execute();

		const result = await RunScoreImportOnce({
			importID: "stress-stale-lock",
			importType: "ir/direct-manual",
			parserArguments: [buildBatch([iidxScore({ score: 800 })]), false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind, "a >1h-old lock must be auto-freed; the next import must proceed").toBe(
			"done",
		);
	});

	it("a backdated score that beats the current PB takes over even though it was achieved years ago", async () => {
		// First import: a recent, mediocre score becomes the PB.
		const recentBatch = buildBatch([
			iidxScore({ score: 600, timeAchieved: 1_700_000_000_000 }),
		]);
		const r1 = await RunScoreImportOnce({
			importID: "stress-pb-backdate-1",
			importType: "ir/direct-manual",
			parserArguments: [recentBatch, false],
			userID: 1,
			userIntent: true,
		});
		expect(r1.kind).toBe("done");
		if (r1.kind !== "done") {
			return;
		}
		const recentScoreId = r1.importDoc.scoreIDs[0]!;

		// Second import: a much older score (10 years ago) but with a far better EX score.
		const tenYearsAgoMs = 1_400_000_000_000;
		const oldBatch = buildBatch([iidxScore({ score: 1500, timeAchieved: tenYearsAgoMs })]);
		const r2 = await RunScoreImportOnce({
			importID: "stress-pb-backdate-2",
			importType: "ir/direct-manual",
			parserArguments: [oldBatch, false],
			userID: 1,
			userIntent: true,
		});
		expect(r2.kind).toBe("done");
		if (r2.kind !== "done") {
			return;
		}
		const olderScoreId = r2.importDoc.scoreIDs[0]!;
		expect(olderScoreId).not.toBe(recentScoreId);

		// PB must be composed from the older-but-better score.
		const pbRow = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", 1)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirstOrThrow();

		const composed = await DB.selectFrom("pb_composed_from")
			.select("pb_composed_from.score_id")
			.where("pb_composed_from.pb_id", "=", pbRow.row_id)
			.execute();

		const composedIds = composed.map((r) => r.score_id);
		expect(
			composedIds,
			"PB must reference the better (older) score after the second import",
		).toContain(olderScoreId);
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Revert + re-import
	// ────────────────────────────────────────────────────────────────────────────

	it("import → revert → re-import leaves the user in a clean, equivalent state", async () => {
		const batch = buildBatch([iidxScore({ score: 1300, timeAchieved: 1_700_000_000_000 })]);

		const r1 = await RunScoreImportOnce({
			importID: "stress-revert-cycle-1",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});
		expect(r1.kind).toBe("done");
		if (r1.kind !== "done") {
			return;
		}
		expect(r1.importDoc.scoreIDs).toHaveLength(1);

		const firstScoreId = r1.importDoc.scoreIDs[0]!;

		const pbBefore = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", 1)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirst();
		expect(pbBefore, "PB must exist after first import").toBeDefined();

		const revertErr = await RevertImport(r1.importDoc);
		expect(revertErr, "revert must succeed").toBeNull();

		const scoreAfterRevert = await DB.selectFrom("score")
			.select("score.id")
			.where("score.id", "=", firstScoreId)
			.executeTakeFirst();
		expect(scoreAfterRevert, "score must be gone after revert").toBeUndefined();

		const pbAfterRevert = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", 1)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirst();
		expect(pbAfterRevert, "PB must be cleaned up after revert").toBeUndefined();

		// Re-import same payload — must succeed and produce the same scoreID
		// (deterministic hash) since the user/chart/metrics are unchanged.
		const r2 = await RunScoreImportOnce({
			importID: "stress-revert-cycle-2",
			importType: "ir/direct-manual",
			parserArguments: [batch, false],
			userID: 1,
			userIntent: true,
		});
		expect(r2.kind).toBe("done");
		if (r2.kind !== "done") {
			return;
		}

		expect(r2.importDoc.scoreIDs).toHaveLength(1);
		expect(r2.importDoc.scoreIDs[0], "scoreID must be deterministic across import cycles").toBe(
			firstScoreId,
		);

		const pbAfterReimport = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", 1)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.executeTakeFirst();
		expect(pbAfterReimport, "PB must be reconstructed after re-import").toBeDefined();
	});
});
