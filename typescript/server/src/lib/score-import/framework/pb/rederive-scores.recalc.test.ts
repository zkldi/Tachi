import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { newGameProfilePreferenceColumns } from "#lib/game-settings/create-game-settings";
import {
	drainGameProfileDirty,
	drainPbDirty,
	drainScoreRederive,
	drainSessionDirty,
	drainStatsQueuesInOrder,
} from "#lib/jobs/drain-dirty-queues";
import { log } from "#lib/log/log";
import { CreateSessionCalcData } from "#lib/score-import/framework/calculated-data/session";
import { rederiveScoresForChart } from "#lib/score-import/framework/pb/rederive-scores";
import { scoreVisibleSql } from "#lib/score-import/framework/pg/score-visibility";
import { mongoScoreDataToPg, pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import { type ChartDocument, type PgScoreData, type ScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

let recalcSeedCounter = 0;

function buildIidxSpChartDoc(
	chartId: string,
	songId: string,
	levelNum: number,
	notecount: number,
): ChartDocument<"iidx-sp"> {
	return {
		...Testing511SPA,
		chartID: chartId,
		song: { ...Testing511Song, id: songId },
		levelNum,
		level: String(levelNum),
		data: {
			...Testing511SPA.data,
			notecount,
		},
	};
}

async function seedIidxSpGameProfile(userId: number) {
	await DB.insertInto("game_profile")
		.values({
			user_id: userId,
			game: "iidx-sp",
			ratings: JSON.stringify({}),
			classes: JSON.stringify({}),
			...newGameProfilePreferenceColumns("iidx-sp"),
		})
		.execute();
}

async function insertSongAndChart(chartDoc: ChartDocument<"iidx-sp">) {
	const songId = chartDoc.song.id;
	const chartId = chartDoc.chartID;
	const n = ++recalcSeedCounter;

	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 91_000 + n,
			game_group: "iidx",
			title: chartDoc.song.title,
			artist: chartDoc.song.artist,
			search_terms: chartDoc.song.searchTerms,
			alt_titles: chartDoc.song.altTitles,
			data: chartDoc.song.data as object,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `legacy_recalc_${chartId}`,
			game: "iidx-sp",
			song_id: songId,
			difficulty: chartDoc.difficulty,
			level: chartDoc.level,
			level_num: chartDoc.levelNum,
			is_primary: chartDoc.isPrimary,
			versions: chartDoc.versions,
			data: chartDoc.data as object,
			derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", chartDoc),
		})
		.execute();

	return { chartId, songId };
}

let insertIidxScoreCounter = 0;

async function insertIidxScore(opts: {
	chartId: string;
	scoreData: ScoreData<"iidx-sp">;
	sessionId?: string | null;
	userId: number;
}) {
	const now = new Date().toISOString();
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", opts.scoreData);
	const scoreId = `sc-recalc-${opts.chartId}`;

	await DB.insertInto("score")
		.values({
			id: scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: opts.sessionId ?? null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({}),
			time_achieved: now,
			time_added: now,
			highlight: false,
			comment: null,
		})
		.execute();

	return scoreId;
}

/** Like `insertIidxScore` but generates a unique score ID so multiple scores can be inserted for the same chart. */
async function insertIidxScoreN(opts: {
	chartId: string;
	scoreData: ScoreData<"iidx-sp">;
	sessionId?: string | null;
	userId: number;
}) {
	const now = new Date().toISOString();
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", opts.scoreData);
	const scoreId = `sc-recalc-n-${opts.chartId}-${++insertIidxScoreCounter}`;

	await DB.insertInto("score")
		.values({
			id: scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: opts.sessionId ?? null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({}),
			time_achieved: now,
			time_added: now,
			highlight: false,
			comment: null,
		})
		.execute();

	return scoreId;
}

function parseJsonb<T>(v: unknown): T {
	if (typeof v === "string") {
		return JSON.parse(v) as T;
	}

	return v as T;
}

async function loadScoresForSession(sessionId: string) {
	const scoreRows = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("score.session_id", "=", sessionId)
		.where(scoreVisibleSql())
		.execute();

	return scoreRows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow));
}

async function loadScorePayload(chartId: string) {
	const row = await DB.selectFrom("score")
		.select(["score.data", "score.derived_data", "score.judgements", "score.calculated_data"])
		.where("score.chart_id", "=", chartId)
		.executeTakeFirstOrThrow();

	return {
		calculatedData: parseJsonb<{ BPI: number | null; ktLampRating: number }>(
			row.calculated_data,
		),
		scoreData: pgScoreDataToAPI("iidx-sp", {
			data: parseJsonb(row.data),
			derived: parseJsonb(row.derived_data),
			judgements: parseJsonb(row.judgements),
		} as PgScoreData<"iidx-sp">),
	};
}

describe("rederiveScoresForChart / chart checksum recalc (Postgres)", () => {
	it("enqueues score_rederive when chart derivation_checksum changes", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_TRIG_${++recalcSeedCounter}`;
		const songId = `S_RECALC_TRIG_${recalcSeedCounter}`;
		const docV1 = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(docV1);

		const docV2 = buildIidxSpChartDoc(chartId, songId, 11, 786);
		const checksum2 = ComputeChartStabilityChecksum("iidx-sp", docV2);

		await DB.updateTable("chart")
			.set({
				level: docV2.level,
				level_num: docV2.levelNum,
				derivation_checksum: checksum2,
			})
			.where("chart.id", "=", chartId)
			.execute();

		const queued = await DB.selectFrom("score_rederive")
			.select(["score_rederive.chart_id"])
			.where("score_rederive.chart_id", "=", chartId)
			.executeTakeFirst();

		expect(queued?.chart_id).toBe(chartId);
	});

	it("does not enqueue score_rederive when derivation_checksum is unchanged", async () => {
		const chartId = `C_RECALC_NOTRIG_${++recalcSeedCounter}`;
		const songId = `S_RECALC_NOTRIG_${recalcSeedCounter}`;
		const doc = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(doc);

		await DB.updateTable("chart")
			.set({ legacy_id: `legacy_recalc_updated_${chartId}` })
			.where("chart.id", "=", chartId)
			.execute();

		const queued = await DB.selectFrom("score_rederive")
			.select(["score_rederive.chart_id"])
			.where("score_rederive.chart_id", "=", chartId)
			.executeTakeFirst();

		expect(queued).toBeUndefined();
	});

	it("updates calculated_data.ktLampRating when chart level_num changes (CLEAR lamp)", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_LVL_${++recalcSeedCounter}`;
		const songId = `S_RECALC_LVL_${recalcSeedCounter}`;
		const doc10 = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(doc10);

		await insertIidxScore({
			chartId,
			userId,
			scoreData: {
				lamp: "CLEAR",
				score: 1000,
				grade: "AAA",
				percent: 90,
				optional: {},
				judgements: { pgreat: 500, great: 0 },
			} as ScoreData<"iidx-sp">,
		});

		await rederiveScoresForChart(chartId, log);
		let { calculatedData } = await loadScorePayload(chartId);
		expect(calculatedData.ktLampRating).toBe(10);

		const doc12 = buildIidxSpChartDoc(chartId, songId, 12, 786);
		await DB.updateTable("chart")
			.set({
				level: doc12.level,
				level_num: doc12.levelNum,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", doc12),
			})
			.where("chart.id", "=", chartId)
			.execute();

		await rederiveScoresForChart(chartId, log);
		({ calculatedData } = await loadScorePayload(chartId));
		expect(calculatedData.ktLampRating).toBe(12);
	});

	it("updates derived percent and grade when chart notecount changes (fixed EX score)", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_NC_${++recalcSeedCounter}`;
		const songId = `S_RECALC_NC_${recalcSeedCounter}`;
		const doc1k = buildIidxSpChartDoc(chartId, songId, 10, 1000);
		await insertSongAndChart(doc1k);

		await insertIidxScore({
			chartId,
			userId,
			scoreData: {
				lamp: "CLEAR",
				score: 1000,
				grade: "AAA",
				percent: 50,
				optional: {},
				judgements: { pgreat: 500, great: 0 },
			} as ScoreData<"iidx-sp">,
		});

		await rederiveScoresForChart(chartId, log);
		let { scoreData } = await loadScorePayload(chartId);
		expect(scoreData.percent).toBeCloseTo(50, 5);
		expect(scoreData.grade).toBe("C");

		const doc500 = buildIidxSpChartDoc(chartId, songId, 10, 500);
		await DB.updateTable("chart")
			.set({
				data: doc500.data as object,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", doc500),
			})
			.where("chart.id", "=", chartId)
			.execute();

		await rederiveScoresForChart(chartId, log);
		({ scoreData } = await loadScorePayload(chartId));
		expect(scoreData.percent).toBeCloseTo(100, 5);
		expect(scoreData.grade).toBe("MAX");
	});

	it("refreshes pb.calculated_data after rederive and drainPbDirty", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_PB_${++recalcSeedCounter}`;
		const songId = `S_RECALC_PB_${recalcSeedCounter}`;
		const doc10 = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(doc10);

		await insertIidxScore({
			chartId,
			userId,
			scoreData: {
				lamp: "CLEAR",
				score: 1000,
				grade: "AAA",
				percent: 50,
				optional: {},
				judgements: { pgreat: 500, great: 0 },
			} as ScoreData<"iidx-sp">,
		});

		await rederiveScoresForChart(chartId, log);
		await drainPbDirty();

		const doc14 = buildIidxSpChartDoc(chartId, songId, 14, 786);
		await DB.updateTable("chart")
			.set({
				level: doc14.level,
				level_num: doc14.levelNum,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", doc14),
			})
			.where("chart.id", "=", chartId)
			.execute();

		await rederiveScoresForChart(chartId, log);
		await drainPbDirty();

		const scoreRow = await loadScorePayload(chartId);
		const pbRow = await DB.selectFrom("pb")
			.select(["pb.calculated_data"])
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.where("pb.lens", "is", null)
			.executeTakeFirstOrThrow();

		const pbCalc = parseJsonb<{ ktLampRating: number }>(pbRow.calculated_data);
		expect(scoreRow.calculatedData.ktLampRating).toBe(14);
		expect(pbCalc.ktLampRating).toBe(14);
	});

	it("drainScoreRederive runs rederive and clears score_rederive for the chart", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_DRAIN_${++recalcSeedCounter}`;
		const songId = `S_RECALC_DRAIN_${recalcSeedCounter}`;
		const docA = buildIidxSpChartDoc(chartId, songId, 9, 786);
		await insertSongAndChart(docA);

		await insertIidxScore({
			chartId,
			userId,
			scoreData: {
				lamp: "CLEAR",
				score: 1000,
				grade: "AAA",
				percent: 50,
				optional: {},
				judgements: { pgreat: 500, great: 0 },
			} as ScoreData<"iidx-sp">,
		});

		const docB = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await DB.updateTable("chart")
			.set({
				level: docB.level,
				level_num: docB.levelNum,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", docB),
			})
			.where("chart.id", "=", chartId)
			.execute();

		const n = await drainScoreRederive();
		expect(n).toBeGreaterThanOrEqual(1);

		const stillQueued = await DB.selectFrom("score_rederive")
			.select(["score_rederive.chart_id"])
			.where("score_rederive.chart_id", "=", chartId)
			.executeTakeFirst();

		expect(stillQueued).toBeUndefined();

		const { calculatedData } = await loadScorePayload(chartId);
		expect(calculatedData.ktLampRating).toBe(10);
	});

	it("updates session.calculated_data and game_profile.ratings after rederive + pb + session + profile drains", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_STATS_${++recalcSeedCounter}`;
		const songId = `S_RECALC_STATS_${recalcSeedCounter}`;
		const sessionId = `sess-recalc-stats-${chartId}`;
		const doc10 = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(doc10);

		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "Recalc stats test",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({}),
				highlight: false,
			})
			.execute();

		await insertIidxScore({
			chartId,
			userId,
			sessionId,
			scoreData: {
				lamp: "CLEAR",
				score: 1000,
				grade: "AAA",
				percent: 50,
				optional: {},
				judgements: { pgreat: 500, great: 0 },
			} as ScoreData<"iidx-sp">,
		});

		await rederiveScoresForChart(chartId, log);
		await drainPbDirty();
		await drainSessionDirty();
		await drainGameProfileDirty();

		let sessRow = await DB.selectFrom("session")
			.select(["session.calculated_data"])
			.where("session.id", "=", sessionId)
			.executeTakeFirstOrThrow();

		let scoreDocs = await loadScoresForSession(sessionId);
		let expectedSession = CreateSessionCalcData("iidx-sp", scoreDocs);
		expect(parseJsonb(sessRow.calculated_data)).toEqual(expectedSession);

		let gpRow = await DB.selectFrom("game_profile")
			.select(["game_profile.ratings"])
			.where("game_profile.user_id", "=", userId)
			.where("game_profile.game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		let ratings = parseJsonb<{ ktLampRating: number | null }>(gpRow.ratings);
		// ProfileAvgBestN(..., 20, returnMean): one PB => ktLampRating / 20.
		expect(ratings.ktLampRating).toBeCloseTo(0.5, 5);

		const doc14 = buildIidxSpChartDoc(chartId, songId, 14, 786);

		await DB.updateTable("chart")
			.set({
				level: doc14.level,
				level_num: doc14.levelNum,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", doc14),
			})
			.where("chart.id", "=", chartId)
			.execute();

		await rederiveScoresForChart(chartId, log);
		await drainPbDirty();
		await drainSessionDirty();
		await drainGameProfileDirty();

		sessRow = await DB.selectFrom("session")
			.select(["session.calculated_data"])
			.where("session.id", "=", sessionId)
			.executeTakeFirstOrThrow();

		scoreDocs = await loadScoresForSession(sessionId);
		expectedSession = CreateSessionCalcData("iidx-sp", scoreDocs);
		expect(parseJsonb(sessRow.calculated_data)).toEqual(expectedSession);

		gpRow = await DB.selectFrom("game_profile")
			.select(["game_profile.ratings"])
			.where("game_profile.user_id", "=", userId)
			.where("game_profile.game", "=", "iidx-sp")
			.executeTakeFirstOrThrow();

		ratings = parseJsonb<{ ktLampRating: number | null }>(gpRow.ratings);
		expect(ratings.ktLampRating).toBeCloseTo(0.7, 5);
	});

	it("drainStatsQueuesInOrder completes with empty queues", async () => {
		await drainStatsQueuesInOrder();
	});

	it("bulk-updates all scores on a multi-score chart correctly", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_BULK_${++recalcSeedCounter}`;
		const songId = `S_RECALC_BULK_${recalcSeedCounter}`;
		const doc10 = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(doc10);

		const scoreData = {
			lamp: "CLEAR",
			score: 1000,
			grade: "AAA",
			percent: 50,
			optional: {},
			judgements: { pgreat: 500, great: 0 },
		} as ScoreData<"iidx-sp">;

		const scoreIds = await Promise.all([
			insertIidxScoreN({ chartId, userId, scoreData }),
			insertIidxScoreN({ chartId, userId, scoreData }),
			insertIidxScoreN({ chartId, userId, scoreData }),
		]);

		// Run rederive at level 10 first so derived_data / calculated_data are valid
		await rederiveScoresForChart(chartId, log);

		// Now bump to level 12 and re-derive
		const doc12 = buildIidxSpChartDoc(chartId, songId, 12, 786);

		await DB.updateTable("chart")
			.set({
				level: doc12.level,
				level_num: doc12.levelNum,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", doc12),
			})
			.where("chart.id", "=", chartId)
			.execute();

		await rederiveScoresForChart(chartId, log);

		for (const scoreId of scoreIds) {
			const row = await DB.selectFrom("score")
				.select(["score.calculated_data"])
				.where("score.id", "=", scoreId)
				.executeTakeFirstOrThrow();

			const calc = parseJsonb<{ ktLampRating: number }>(row.calculated_data);
			expect(calc.ktLampRating).toBe(12);
		}
	});

	it("skips UPDATE and pb_dirty enqueue when derived/calculated_data is unchanged", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_NOOP_${++recalcSeedCounter}`;
		const songId = `S_RECALC_NOOP_${recalcSeedCounter}`;
		const doc10 = buildIidxSpChartDoc(chartId, songId, 10, 786);
		await insertSongAndChart(doc10);

		await insertIidxScore({
			chartId,
			userId,
			scoreData: {
				lamp: "CLEAR",
				score: 1000,
				grade: "AAA",
				percent: 50,
				optional: {},
				judgements: { pgreat: 500, great: 0 },
			} as ScoreData<"iidx-sp">,
		});

		// First pass: produces correct derived/calculated_data and enqueues pb_dirty
		await rederiveScoresForChart(chartId, log);

		// Drain pb_dirty so we can detect if a second rederive enqueues it again
		await drainPbDirty();

		const pbDirtyBefore = await DB.selectFrom("pb_dirty")
			.select((eb) => eb.fn.countAll<string>().as("n"))
			.where("pb_dirty.chart_id", "=", chartId)
			.executeTakeFirstOrThrow();

		expect(Number(pbDirtyBefore.n)).toBe(0);

		// Second pass: chart is unchanged, so all scores should be skipped
		const updated = await rederiveScoresForChart(chartId, log);

		expect(updated).toBe(0);

		const pbDirtyAfter = await DB.selectFrom("pb_dirty")
			.select((eb) => eb.fn.countAll<string>().as("n"))
			.where("pb_dirty.chart_id", "=", chartId)
			.executeTakeFirstOrThrow();

		// No new pb_dirty rows should be enqueued since no score was updated
		expect(Number(pbDirtyAfter.n)).toBe(0);
	});

	it("drainScoreRederive removes queue entry after processing a multi-score chart", async () => {
		const { id: userId } = await seedUser();
		await seedIidxSpGameProfile(userId);

		const chartId = `C_RECALC_DRAINMULTI_${++recalcSeedCounter}`;
		const songId = `S_RECALC_DRAINMULTI_${recalcSeedCounter}`;
		const docA = buildIidxSpChartDoc(chartId, songId, 9, 786);
		await insertSongAndChart(docA);

		const scoreData = {
			lamp: "CLEAR",
			score: 1000,
			grade: "AAA",
			percent: 50,
			optional: {},
			judgements: { pgreat: 500, great: 0 },
		} as ScoreData<"iidx-sp">;

		await Promise.all([
			insertIidxScoreN({ chartId, userId, scoreData }),
			insertIidxScoreN({ chartId, userId, scoreData }),
		]);

		const docB = buildIidxSpChartDoc(chartId, songId, 11, 786);

		await DB.updateTable("chart")
			.set({
				level: docB.level,
				level_num: docB.levelNum,
				derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", docB),
			})
			.where("chart.id", "=", chartId)
			.execute();

		const n = await drainScoreRederive();
		expect(n).toBeGreaterThanOrEqual(1);

		const stillQueued = await DB.selectFrom("score_rederive")
			.select(["score_rederive.chart_id"])
			.where("score_rederive.chart_id", "=", chartId)
			.executeTakeFirst();

		expect(stillQueued).toBeUndefined();

		// Both scores should reflect the updated chart level
		const scoreRows = await DB.selectFrom("score")
			.select(["score.calculated_data"])
			.where("score.chart_id", "=", chartId)
			.execute();

		expect(scoreRows).toHaveLength(2);

		for (const row of scoreRows) {
			const calc = parseJsonb<{ ktLampRating: number }>(row.calculated_data);
			expect(calc.ktLampRating).toBe(11);
		}
	});
});
