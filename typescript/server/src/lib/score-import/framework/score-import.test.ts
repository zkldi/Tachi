import type { ScoreImportJobData } from "#lib/score-import/worker/types";

import { seedUser } from "#actions/test-utils/api-tokens";
import { CDNRetrieve } from "#lib/cdn/cdn";
import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import { StartTrackingImport } from "#lib/score-import/framework/status-tracking/import-status-tracking";
import { RunScoreImportOnce } from "#lib/score-import/worker/run-score-import";
import DB from "#services/pg/db";
import {
	FakeSmallBatchManual,
	Testing511Song,
	Testing511SPA,
	TestingJubeatSong,
} from "#test-utils/test-data";
import { Sleep } from "#utils/misc";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { beforeEach, describe, expect, it } from "vitest";

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

describe("RunScoreImportOnce (ported from score-import.oldtest.ts)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "score-import-mks@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seed511Chart();
	});

	it("imports BATCH-MANUAL and matches LoadImportDocumentById", async () => {
		const result = await RunScoreImportOnce({
			importID: "mockImportID",
			importType: "ir/direct-manual",
			parserArguments: [FakeSmallBatchManual, false],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}
		const res = result.importDoc;

		expect(res.importID).toBe("mockImportID");

		const dbRes = await LoadImportDocumentById("mockImportID");
		expect(dbRes).toBeDefined();
		expect(dbRes?.importID).toBe("mockImportID");

		const tracker = await DB.selectFrom("import_tracker")
			.select("import_id")
			.where("import_id", "=", "mockImportID")
			.executeTakeFirst();

		expect(tracker).toBeUndefined();

		expect(res).toEqual(dbRes);
	});

	it.skipIf(!process.env.TACHI_CDN_SAVE_LOCATION_BUCKET)(
		"stores import-input on CDN when TACHI_CDN_SAVE_LOCATION_BUCKET is set",
		async () => {
			const jobData: ScoreImportJobData<"ir/direct-manual"> = {
				importID: "mockImportID_cdn",
				importType: "ir/direct-manual",
				parserArguments: [FakeSmallBatchManual, false],
				userID: 1,
				userIntent: true,
			};

			// Production enqueues tracking (including CDN upload) before the worker runs
			// RunScoreImportOnce with skipStartTracking.
			await StartTrackingImport(jobData);
			await RunScoreImportOnce(jobData);

			await Sleep(800);

			const cdnRes = await CDNRetrieve("/score-import-input/mockImportID_cdn").then((r) =>
				JSON.parse(r.toString("utf-8")),
			);

			expect(cdnRes).toEqual([
				{
					meta: { game: "iidx", playtype: "SP", service: "foobar" },
					scores: [
						{
							score: 500,
							lamp: "HARD CLEAR",
							matchType: "songTitle",
							identifier: "5.1.1.",
							difficulty: "ANOTHER",
						},
					],
				},
				false,
			]);
		},
	);
});

const JUBEAT_ARRAY_IG_FIRST = 80000037;

function padLegacyChartId(legacyId: number): string {
	return String(legacyId).padStart(40, "0");
}

function mkBatchManualMulterFile(body: object): Express.Multer.File {
	return {
		buffer: Buffer.from(JSON.stringify(body), "utf-8"),
	} as Express.Multer.File;
}

function jubeatScoreLine(opts: {
	identifier: number | string;
	musicRate?: number;
	score?: number;
	timeAchieved: number;
}) {
	return {
		difficulty: "ADV" as const,
		identifier: String(opts.identifier),
		judgements: {
			good: 0,
			great: 0,
			miss: 0,
			perfect: 100,
			poor: 0,
		},
		lamp: "CLEAR" as const,
		matchType: "inGameID" as const,
		musicRate: opts.musicRate ?? 96.5,
		score: opts.score ?? 920_000,
		timeAchieved: opts.timeAchieved,
	};
}

async function seedJubeatChartArrayInGameID(opts: { chartId: string; legacyId: number }) {
	await DB.insertInto("song")
		.values({
			id: `${TestingJubeatSong.id}-smoke-${opts.chartId}`,
			legacy_id: opts.legacyId,
			game_group: "jubeat",
			title: TestingJubeatSong.title,
			artist: TestingJubeatSong.artist,
			search_terms: TestingJubeatSong.searchTerms,
			alt_titles: TestingJubeatSong.altTitles,
			data: TestingJubeatSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: opts.chartId,
			legacy_id: padLegacyChartId(opts.legacyId),
			game: "jubeat",
			song_id: `${TestingJubeatSong.id}-smoke-${opts.chartId}`,
			difficulty: "ADV",
			level: "6",
			level_num: 6,
			is_primary: true,
			versions: ["festo"],
			data: JSON.stringify({
				inGameID: [JUBEAT_ARRAY_IG_FIRST, 50_000_020],
				noteCount: 100,
				musicBar: [0, 1, 2, 3],
			}),
		})
		.execute();
}

async function seedJubeatChartScalarInGameID(opts: {
	chartId: string;
	inGameID: number;
	legacyId: number;
	songIdSuffix: string;
}) {
	await DB.insertInto("song")
		.values({
			id: `${TestingJubeatSong.id}-${opts.songIdSuffix}`,
			legacy_id: opts.legacyId,
			game_group: "jubeat",
			title: TestingJubeatSong.title,
			artist: TestingJubeatSong.artist,
			search_terms: TestingJubeatSong.searchTerms,
			alt_titles: TestingJubeatSong.altTitles,
			data: TestingJubeatSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: opts.chartId,
			legacy_id: padLegacyChartId(opts.legacyId),
			game: "jubeat",
			song_id: `${TestingJubeatSong.id}-${opts.songIdSuffix}`,
			difficulty: "ADV",
			level: "6",
			level_num: 6,
			is_primary: true,
			versions: ["festo"],
			data: JSON.stringify({
				inGameID: opts.inGameID,
				noteCount: 100,
				musicBar: [0, 1, 2, 3],
			}),
		})
		.execute();
}

describe("batch-manual score import (smoke)", () => {
	beforeEach(async () => {
		await seedUser({
			username: "test_batch_manual_smoke",
			email: "batch-manual-smoke@example.com",
			withCredential: true,
			withSettings: true,
		});
	});

	it("file/batch-manual: jubeat inGameID matches chart with array inGameID and commits scores", async () => {
		const chartId = "chart-smoke-jubeat-array-ingameid";
		await seedJubeatChartArrayInGameID({ chartId, legacyId: 9_001 });

		const baseMs = Date.UTC(2024, 5, 1, 12, 0, 0, 0);
		const batch = {
			meta: { game: "jubeat", playtype: "Single", service: "smoke-test" },
			scores: [jubeatScoreLine({ identifier: JUBEAT_ARRAY_IG_FIRST, timeAchieved: baseMs })],
		};

		const importID = "import-smoke-jubeat-array";
		const result = await RunScoreImportOnce({
			importID,
			importType: "file/batch-manual",
			parserArguments: [mkBatchManualMulterFile(batch), {}],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}
		const doc = result.importDoc;

		expect(doc.scoreIDs).toHaveLength(1);
		expect(doc.errors).toHaveLength(0);

		const nCommitted = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("import_id", "=", importID)
			.where("committed", "=", true)
			.executeTakeFirst();

		expect(Number(nCommitted?.c)).toBe(1);
	});

	it("second import of identical data reports no sessions", async () => {
		await seedJubeatChartScalarInGameID({
			chartId: "chart-dedup-sessions",
			inGameID: 20_000_001,
			legacyId: 9_010,
			songIdSuffix: "dedup-sessions-song",
		});

		const baseMs = Date.UTC(2024, 3, 1, 14, 0, 0, 0);
		const batch = {
			meta: { game: "jubeat", playtype: "Single", service: "dedup-test" },
			scores: [jubeatScoreLine({ identifier: 20_000_001, timeAchieved: baseMs })],
		};

		const result1 = await RunScoreImportOnce({
			importID: "import-dedup-sessions-1",
			importType: "file/batch-manual",
			parserArguments: [mkBatchManualMulterFile(batch), {}],
			userID: 1,
			userIntent: true,
		});

		expect(result1.kind).toBe("done");
		if (result1.kind !== "done") {
			return;
		}
		const doc1 = result1.importDoc;

		// Sanity check: first import should have created exactly one session
		expect(doc1.createdSessions).toHaveLength(1);
		expect(doc1.createdSessions[0]?.type).toBe("Created");

		const result2 = await RunScoreImportOnce({
			importID: "import-dedup-sessions-2",
			importType: "file/batch-manual",
			parserArguments: [mkBatchManualMulterFile(batch), {}],
			userID: 1,
			userIntent: true,
		});

		expect(result2.kind).toBe("done");
		if (result2.kind !== "done") {
			return;
		}
		const doc2 = result2.importDoc;

		// Second import of identical data should claim no sessions — no new scores
		// were actually committed, so no session was touched.
		expect(doc2.createdSessions).toHaveLength(0);
	});

	it("file/batch-manual: two session groups appending the same nearby session finalizes import_session without error", async () => {
		await seedJubeatChartScalarInGameID({
			chartId: "chart-smoke-jubeat-dup-a",
			inGameID: 10_000_001,
			legacyId: 9_002,
			songIdSuffix: "smoke2-song-a",
		});
		await seedJubeatChartScalarInGameID({
			chartId: "chart-smoke-jubeat-dup-b",
			inGameID: 10_000_002,
			legacyId: 9_003,
			songIdSuffix: "smoke2-song-b",
		});

		const baseMs = Date.UTC(2024, 5, 10, 8, 0, 0, 0);
		const sessionId = `Q${"a".repeat(40)}`;

		const sixHoursMs = 6 * 60 * 60 * 1000;
		const oneHourMs = 60 * 60 * 1000;

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: 1,
				game: "jubeat",
				name: "preseed-smoke",
				description: null,
				time_inserted: UnixMillisecondsToISO8601(Date.now()),
				time_started: UnixMillisecondsToISO8601(baseMs),
				time_ended: UnixMillisecondsToISO8601(baseMs + sixHoursMs),
				calculated_data: JSON.stringify({ jubility: null }),
				highlight: false,
			})
			.execute();

		const batch = {
			meta: { game: "jubeat", playtype: "Single", service: "smoke-test" },
			scores: [
				jubeatScoreLine({
					identifier: 10_000_001,
					musicRate: 95.0,
					score: 910_000,
					timeAchieved: baseMs + oneHourMs,
				}),
				jubeatScoreLine({
					identifier: 10_000_002,
					musicRate: 97.0,
					score: 925_000,
					timeAchieved: baseMs + 5 * oneHourMs,
				}),
			],
		};

		const importID = "import-smoke-jubeat-session-meta";
		const result = await RunScoreImportOnce({
			importID,
			importType: "file/batch-manual",
			parserArguments: [mkBatchManualMulterFile(batch), {}],
			userID: 1,
			userIntent: true,
		});

		expect(result.kind).toBe("done");
		if (result.kind !== "done") {
			return;
		}
		const doc = result.importDoc;

		expect(doc.scoreIDs).toHaveLength(2);
		expect(doc.errors).toHaveLength(0);

		const nCommitted = await DB.selectFrom("score")
			.select((eb) => eb.fn.countAll<number>().as("c"))
			.where("import_id", "=", importID)
			.where("committed", "=", true)
			.executeTakeFirst();

		expect(Number(nCommitted?.c)).toBe(2);

		const importSessionRows = await DB.selectFrom("import_session")
			.select("session_id")
			.where("import_id", "=", importID)
			.execute();

		expect(importSessionRows).toHaveLength(1);
		expect(importSessionRows[0]?.session_id).toBe(sessionId);
	});
});
