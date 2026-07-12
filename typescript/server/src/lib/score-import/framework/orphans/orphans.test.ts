import type { BatchManualContext } from "#lib/score-import/import-types/common/batch-manual/types";
import type { OrphanScoreDocument } from "#lib/score-import/import-types/common/types";
import type { BatchManualScore } from "tachi-common";

import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import deepmerge from "deepmerge";
import fjsh from "fast-json-stable-hash";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { OrphanScore, ReprocessOrphan, summarizeOrphanRow } from "./orphans";

const batchManualScore: BatchManualScore = {
	score: 500,
	lamp: "HARD CLEAR",
	matchType: "songTitle",
	identifier: "5.1.1.",
	difficulty: "ANOTHER",
};

const batchManualContext: BatchManualContext = {
	game: "iidx-sp",
	service: "foo",
	version: "27",
};

const SONG_PG_ID = "S_ORPHAN_TEST_SONG";
const CHART_PG_ID = "C_ORPHAN_TEST_CHART";
const CHART_LEGACY_ID = "c2311194e3897ddb5745b1760d2c0141f933e683";

async function seedIidxSongAndChart() {
	await DB.insertInto("song")
		.values({
			id: SONG_PG_ID,
			legacy_id: 1,
			game_group: "iidx",
			title: "5.1.1.",
			artist: "dj nagureo",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "PIANO AMBIENT" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: CHART_PG_ID,
			legacy_id: CHART_LEGACY_ID,
			game: "iidx-sp",
			song_id: SONG_PG_ID,
			difficulty: "ANOTHER",
			level: "10",
			level_num: 10,
			is_primary: true,
			versions: ["27", "26"],
			data: {
				inGameID: 1000,
				notecount: 786,
				kaidenAverage: null,
				worldRecord: null,
			},
		})
		.execute();
}

async function ensureImportStub(opts: { importId: string; userId: number }) {
	await DB.insertInto("import")
		.values({
			id: opts.importId,
			user_id: opts.userId,
			time_started: new Date().toISOString(),
			time_finished: new Date().toISOString(),
			game_group: "iidx",
			import_type: "ir/direct-manual",
			user_intent: true,
			service: "orphan-test",
			status: "completed",
		})
		.execute();
}

describe("summarizeOrphanRow", () => {
	it("returns null when data and context are empty", () => {
		expect(summarizeOrphanRow({ data: {}, context: {} })).toBeNull();
	});

	it("returns the identifier alone when no artist or difficulty", () => {
		expect(summarizeOrphanRow({ data: { identifier: "5.1.1." }, context: {} })).toBe("5.1.1.");
	});

	it("appends artist when present in data", () => {
		expect(
			summarizeOrphanRow({
				data: { identifier: "5.1.1.", artist: "dj nagureo" },
				context: {},
			}),
		).toBe("5.1.1. (dj nagureo)");
	});

	it("appends difficulty when present in data", () => {
		expect(
			summarizeOrphanRow({
				data: { identifier: "5.1.1.", difficulty: "ANOTHER" },
				context: {},
			}),
		).toBe("5.1.1. (ANOTHER)");
	});

	it("appends both artist and difficulty separated by ·", () => {
		expect(
			summarizeOrphanRow({
				data: { identifier: "5.1.1.", artist: "dj nagureo", difficulty: "ANOTHER" },
				context: {},
			}),
		).toBe("5.1.1. (dj nagureo · ANOTHER)");
	});

	it("reads artist from context.chart for beatoraja-style rows", () => {
		expect(
			summarizeOrphanRow({
				data: { sha256: "abc" },
				context: { chart: { artist: "dj artist" } },
			}),
		).toBe("abc (dj artist)");
	});

	it("prefers data.artist over context.chart.artist", () => {
		expect(
			summarizeOrphanRow({
				data: { identifier: "Song", artist: "data artist" },
				context: { chart: { artist: "ctx artist" } },
			}),
		).toBe("Song (data artist)");
	});

	it("falls back to context.chart.sha256 when no other primary", () => {
		const sha = "a".repeat(64);
		const result = summarizeOrphanRow({ data: {}, context: { chart: { sha256: sha } } });
		expect(result).toBe(`sha256:${"a".repeat(16)}...`);
	});

	it("truncates a very long combined summary to 120 chars ending in ...", () => {
		// Primary truncates to 80 chars; 30-char artist + 20-char difficulty push combined > 120.
		const result = summarizeOrphanRow({
			data: {
				identifier: "A".repeat(100),
				artist: "B".repeat(30),
				difficulty: "C".repeat(20),
			},
			context: {},
		});
		expect(result).not.toBeNull();
		expect(result!.length).toBe(120);
		expect(result!.endsWith("...")).toBe(true);
	});

	it("truncates a very long identifier alone at 120 chars", () => {
		const long = "B".repeat(130);
		const result = summarizeOrphanRow({ data: { identifier: long }, context: {} });
		expect(result).toBe(`${"B".repeat(117)}...`);
	});

	it("ignores non-string artist / difficulty values", () => {
		expect(
			summarizeOrphanRow({
				data: { identifier: "Song", artist: 42, difficulty: null },
				context: {},
			}),
		).toBe("Song");
	});
});

describe("OrphanScore (Postgres)", () => {
	it("inserts orphan_score with deterministic orphan_id", async () => {
		const { id: userId } = await seedUser({ username: "orphan_u1" });
		const importId = "import-orphan-1";
		await ensureImportStub({ importId, userId });

		const res = await OrphanScore(
			"ir/direct-manual",
			userId,
			batchManualScore,
			batchManualContext,
			"Example Error Message",
			"iidx",
			log,
			importId,
		);

		expect(res.success).toBe(true);
		expect(res.orphanID).toBe(
			`O${fjsh.hash(
				{
					importType: "ir/direct-manual",
					data: batchManualScore,
					context: batchManualContext,
					userID: userId,
				},
				"sha256",
			)}`,
		);

		const row = await DB.selectFrom("orphan_score")
			.selectAll()
			.where("orphan_id", "=", res.orphanID)
			.executeTakeFirst();

		expect(row).toMatchObject({
			orphan_id: res.orphanID,
			user_id: userId,
			import_id: importId,
			import_type: "ir/direct-manual",
			game_group: "iidx",
			error_message: "Example Error Message",
		});
		expect(row?.data).toEqual(batchManualScore);
		expect(row?.context).toEqual(batchManualContext);
		expect(Math.abs(new Date(row!.time_inserted).getTime() - Date.now())).toBeLessThan(15_000);
	});

	it("skips insert when orphan_id already exists", async () => {
		const { id: userId } = await seedUser({ username: "orphan_u2" });
		const importId = "import-orphan-2";
		await ensureImportStub({ importId, userId });

		const res1 = await OrphanScore(
			"ir/direct-manual",
			userId,
			batchManualScore,
			batchManualContext,
			"Example Error Message",
			"iidx",
			log,
			importId,
		);
		const res2 = await OrphanScore(
			"ir/direct-manual",
			userId,
			batchManualScore,
			batchManualContext,
			"Example Error Message",
			"iidx",
			log,
			importId,
		);

		expect(res1.success).toBe(true);
		expect(res2.success).toBe(false);
		expect(res1.orphanID).toBe(res2.orphanID);

		const n = await DB.selectFrom("orphan_score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("user_id", "=", userId)
			.executeTakeFirstOrThrow();

		expect(Number(n.c)).toBe(1);
	});
});

describe("ReprocessOrphan (Postgres)", () => {
	const orphanDoc: OrphanScoreDocument = {
		context: batchManualContext,
		data: batchManualScore,
		errMsg: "foo",
		importType: "ir/direct-manual",
		orphanID: "orphan-row-foo",
		timeInserted: 0,
		game: "iidx",
		userID: 1,
	};

	it("imports when chart exists", async () => {
		const { id: userId } = await seedUser({ username: "orphan_repro_1" });
		await seedIidxSongAndChart();

		const res = await ReprocessOrphan(
			{ ...orphanDoc, userID: userId, orphanID: "opg-1" },
			[],
			log,
		);

		expect(res).toMatchObject({
			success: true,
			type: "ScoreImported",
		});

		const row = await DB.selectFrom("orphan_score")
			.select("orphan_id")
			.where("orphan_id", "=", "opg-1")
			.executeTakeFirst();
		expect(row).toBeUndefined();
	});

	it("returns null and removes orphan when score is invalid", async () => {
		const { id: userId } = await seedUser({ username: "orphan_repro_2" });
		await seedIidxSongAndChart();

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: orphanDoc.orphanID,
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				data: batchManualScore,
				context: batchManualContext,
				time_inserted: new Date().toISOString(),
				error_message: "foo",
			})
			.execute();

		const res = await ReprocessOrphan(
			deepmerge(orphanDoc, {
				userID: userId,
				data: { score: 99_999 },
			}),
			[],
			log,
		);

		expect(res).toBeNull();

		const row = await DB.selectFrom("orphan_score")
			.select("orphan_id")
			.where("orphan_id", "=", orphanDoc.orphanID)
			.executeTakeFirst();
		expect(row).toBeUndefined();
	});

	it("returns false and keeps orphan when song still missing", async () => {
		const { id: userId } = await seedUser({ username: "orphan_reapro_3" });
		await seedIidxSongAndChart();

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: orphanDoc.orphanID,
				user_id: userId,
				import_id: null,
				import_type: "ir/direct-manual",
				game_group: "iidx",
				data: batchManualScore,
				context: batchManualContext,
				time_inserted: new Date().toISOString(),
				error_message: "foo",
			})
			.execute();

		const res = await ReprocessOrphan(
			deepmerge(orphanDoc, {
				userID: userId,
				data: { identifier: "NONSENSE CHART TITLE" },
			}),
			[],
			log,
		);

		expect(res).toBe(false);

		const row = await DB.selectFrom("orphan_score")
			.select("orphan_id")
			.where("orphan_id", "=", orphanDoc.orphanID)
			.executeTakeFirst();
		expect(row?.orphan_id).toBe(orphanDoc.orphanID);
	});
});

describe("DeorphanScores beatoraja filter (Postgres)", () => {
	it("selects ir/beatoraja rows matching chart sha256 and PMS playtype", async () => {
		const { id: userId } = await seedUser({ username: "orp_beat_1" });
		const sha = "a".repeat(64);

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "obe-ctl",
				user_id: userId,
				import_id: null,
				import_type: "ir/beatoraja",
				game_group: "pms",
				data: { deviceType: "BM_CONTROLLER", sha256: sha },
				context: { chart: { sha256: sha } },
				time_inserted: new Date().toISOString(),
				error_message: "",
			})
			.execute();

		await DB.insertInto("orphan_score")
			.values({
				orphan_id: "obe-kb",
				user_id: userId,
				import_id: null,
				import_type: "ir/beatoraja",
				game_group: "pms",
				data: { deviceType: "KEYBOARD", sha256: sha },
				context: { chart: { sha256: sha } },
				time_inserted: new Date().toISOString(),
				error_message: "",
			})
			.execute();

		const rowsCtrl = await DB.selectFrom("orphan_score")
			.select("orphan_id")
			.where("import_type", "=", "ir/beatoraja")
			.where(sql<boolean>`(orphan_score.context::jsonb->'chart'->>'sha256') = ${sha}`)
			.where(sql<boolean>`(orphan_score.data::jsonb->>'deviceType') = ${"BM_CONTROLLER"}`)
			.execute();

		expect(rowsCtrl.map((r) => r.orphan_id)).toEqual(["obe-ctl"]);

		const keyboardRows = await DB.selectFrom("orphan_score")
			.select("orphan_id")
			.where("user_id", "=", userId)
			.where("import_type", "=", "ir/beatoraja")
			.where(sql<boolean>`(orphan_score.context::jsonb->'chart'->>'sha256') = ${sha}`)
			.where(
				sql<boolean>`(orphan_score.data::jsonb->>'deviceType') IS DISTINCT FROM ${"BM_CONTROLLER"}`,
			)
			.execute();

		expect(keyboardRows.map((r) => r.orphan_id)).toEqual(["obe-kb"]);
	});
});
