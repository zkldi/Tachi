import { ComputeChartStabilityChecksum } from "#game-implementations/utils/derivation-checksum";
import { newCalculationRunStartedAt } from "#lib/dirty-queues/calculation-run";
import {
	claimGameProfileDirtyRows,
	claimPbDirtyRows,
	claimSessionDirtyRows,
} from "#lib/dirty-queues/claim-dirty-queue";
import { clearPbDirtyForUser, drainPbDirty } from "#lib/jobs/drain-dirty-queues";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { ProcessPBs } from "#lib/score-import/framework/pb/process-pbs";
import { upsertPbFromMongoDoc } from "#lib/score-import/framework/pb/upsert-pb-pg";
import { mongoScoreDataToPg, pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { GetChartForIDGuaranteed } from "#utils/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { type PgScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

let raceSeedCounter = 0;

function nextId(prefix: string) {
	raceSeedCounter += 1;
	return `${prefix}-${raceSeedCounter}`;
}

async function readPbPercent(userId: number, chartId: string): Promise<number> {
	const row = await DB.selectFrom("pb")
		.select(["pb.data", "pb.derived_data", "pb.judgements"])
		.where("pb.user_id", "=", userId)
		.where("pb.chart_id", "=", chartId)
		.where("pb.lens", "is", null)
		.executeTakeFirst();

	if (!row) {
		throw new Error(`missing pb for user ${userId} chart ${chartId}`);
	}

	const scoreData = pgScoreDataToAPI("iidx-sp", {
		data: row.data,
		derived: row.derived_data,
		judgements: row.judgements,
	} as PgScoreData<"iidx-sp">);

	return scoreData.percent;
}

async function seedIidxChart(chartId: string, songId: string) {
	await DB.insertInto("song")
		.values({
			id: songId,
			legacy_id: 95_000 + raceSeedCounter,
			game_group: "iidx",
			title: Testing511Song.title,
			artist: Testing511Song.artist,
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
			data: Testing511Song.data,
			fts_document: "",
		})
		.onConflict((oc) => oc.doNothing())
		.execute();

	const chartDoc = {
		...Testing511SPA,
		chartID: chartId,
		song: { ...Testing511Song, id: songId },
	};

	await DB.insertInto("chart")
		.values({
			id: chartId,
			legacy_id: `legacy-race-${chartId}`,
			game: "iidx-sp",
			song_id: songId,
			difficulty: chartDoc.difficulty,
			level: chartDoc.level,
			level_num: chartDoc.levelNum,
			is_primary: chartDoc.isPrimary,
			versions: chartDoc.versions,
			data: chartDoc.data,
			derivation_checksum: ComputeChartStabilityChecksum("iidx-sp", chartDoc),
		})
		.onConflict((oc) => oc.doNothing())
		.execute();
}

async function insertCommittedScore(opts: {
	chartId: string;
	percent: number;
	scoreId: string;
	userId: number;
}) {
	const scoreData = {
		...TestingIIDXSPScore.scoreData,
		percent: opts.percent,
	};
	const doc = mkFakeScoreIIDXSP({
		userID: opts.userId,
		scoreID: opts.scoreId,
		chartID: opts.chartId,
		scoreData,
		calculatedData: TestingIIDXSPScore.calculatedData,
		timeAchieved: 1_700_000_000_000,
		timeAdded: 1_700_000_000_000,
	});
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", doc.scoreData);
	const ts = UnixMillisecondsToISO8601(1_700_000_000_000);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
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

async function insertUncommittedScore(opts: {
	chartId: string;
	importId: string;
	percent: number;
	scoreId: string;
	userId: number;
}) {
	const scoreData = {
		...TestingIIDXSPScore.scoreData,
		percent: opts.percent,
	};
	const doc = mkFakeScoreIIDXSP({
		userID: opts.userId,
		scoreID: opts.scoreId,
		chartID: opts.chartId,
		scoreData,
		calculatedData: TestingIIDXSPScore.calculatedData,
		timeAchieved: 1_700_000_100_000,
		timeAdded: 1_700_000_100_000,
	});
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", doc.scoreData);
	const ts = UnixMillisecondsToISO8601(1_700_000_100_000);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: "iidx-sp",
			session_id: null,
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
			committed: false,
		})
		.execute();
}

/** Run `workerCount` async workers until `work()` returns zero (queue drained). */
async function runParallelUntilIdle(
	workerCount: number,
	work: () => Promise<number>,
): Promise<number> {
	let total = 0;

	while (true) {
		const batchTotals = await Promise.all(Array.from({ length: workerCount }, () => work()));
		const moved = batchTotals.reduce((sum, n) => sum + n, 0);

		if (moved === 0) {
			break;
		}

		total += moved;
	}

	return total;
}

describe("dirty queue race harness", () => {
	it("parallel pb_dirty claims are disjoint (SKIP LOCKED)", async () => {
		const pairs = await Promise.all(
			Array.from({ length: 12 }, async () => {
				const { id: user_id } = await seedUser({ username: nextId("claim-user") });
				const chartId = nextId("chart-claim");
				const songId = nextId("song-claim");
				await seedIidxChart(chartId, songId);
				return { user_id, chart_id: chartId };
			}),
		);

		await DB.insertInto("pb_dirty").values(pairs).execute();

		const workerCount = 8;
		const claims = await Promise.all(
			Array.from({ length: workerCount }, () => claimPbDirtyRows(5)),
		);

		const claimedPairs = claims.flat().map((r) => `${r.user_id}:${r.chart_id}`);
		expect(new Set(claimedPairs).size).toBe(claimedPairs.length);
		expect(claimedPairs).toHaveLength(pairs.length);

		const remaining = await DB.selectFrom("pb_dirty").selectAll().execute();
		expect(remaining).toHaveLength(0);
	});

	it("parallel session_dirty and game_profile_dirty claims are disjoint", async () => {
		const { id: userId } = await seedUser({ username: nextId("sess-gp-claim") });
		const sessionIds = [nextId("sess-a"), nextId("sess-b"), nextId("sess-c")];
		const now = new Date().toISOString();

		for (const sessionId of sessionIds) {
			await DB.insertInto("session")
				.values({
					id: sessionId,
					user_id: userId,
					game: "iidx-sp",
					name: sessionId,
					description: null,
					time_inserted: now,
					time_started: now,
					time_ended: now,
					calculated_data: JSON.stringify({}),
					highlight: false,
				})
				.execute();
		}

		await DB.insertInto("session_dirty")
			.values(sessionIds.map((session_id) => ({ session_id })))
			.execute();

		const sessionClaims = await Promise.all([
			claimSessionDirtyRows(2),
			claimSessionDirtyRows(2),
			claimSessionDirtyRows(2),
		]);
		const claimedSessions = sessionClaims.flat().map((r) => r.session_id);
		expect(new Set(claimedSessions).size).toBe(sessionIds.length);

		const users = await Promise.all([
			seedUser({ username: nextId("gp-u1") }),
			seedUser({ username: nextId("gp-u2") }),
			seedUser({ username: nextId("gp-u3") }),
		]);

		await DB.insertInto("game_profile_dirty")
			.values(
				users.map((u) => ({
					user_id: u.id,
					game: "iidx-sp" as const,
				})),
			)
			.execute();

		const profileClaims = await Promise.all([
			claimGameProfileDirtyRows(2),
			claimGameProfileDirtyRows(2),
			claimGameProfileDirtyRows(2),
		]);
		const claimedProfiles = profileClaims.flat().map((r) => `${r.user_id}:${r.game}`);
		expect(new Set(claimedProfiles).size).toBe(users.length);
	});

	it("concurrent pb upserts: newer-started run wins when stale finishes last", async () => {
		const { id: userId } = await seedUser({ username: nextId("pb-upsert-race") });
		const chartId = nextId("chart-upsert-race");
		const songId = nextId("song-upsert-race");
		await seedIidxChart(chartId, songId);

		await insertCommittedScore({
			chartId,
			scoreId: nextId("score-upsert-race"),
			userId,
			percent: 88,
		});

		const chart = await GetChartForIDGuaranteed(chartId);
		const pbDoc = await CreatePBDoc("iidx-sp", userId, chart, log);
		expect(pbDoc).toBeDefined();

		const newerRun = await newCalculationRunStartedAt();
		const olderRun = new Date(Date.parse(newerRun) - 120_000).toISOString();

		let releaseStale!: () => void;
		const staleMayFinish = new Promise<void>((resolve) => {
			releaseStale = resolve;
		});

		const staleDoc = {
			...pbDoc!,
			scoreData: {
				...pbDoc!.scoreData,
				percent: 1,
			},
		};

		const [staleApplied, newerApplied] = await Promise.all([
			(async () => {
				await staleMayFinish;
				return DB.transaction().execute((trx) =>
					upsertPbFromMongoDoc(trx, staleDoc, olderRun),
				);
			})(),
			(async () => {
				const applied = await DB.transaction().execute((trx) =>
					upsertPbFromMongoDoc(trx, pbDoc!, newerRun),
				);
				releaseStale();
				return applied;
			})(),
		]);

		expect(newerApplied).toBe(true);
		expect(staleApplied).toBe(false);
		expect(await readPbPercent(userId, chartId)).toBe(88);

		const row = await DB.selectFrom("pb")
			.select(["pb.last_clean_started_at"])
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", chartId)
			.where("pb.lens", "is", null)
			.executeTakeFirstOrThrow();

		expect(row.last_clean_started_at).toBe(newerRun);
	});

	it("concurrent session updates: newer-started run wins when stale finishes last", async () => {
		const { id: userId } = await seedUser({ username: nextId("sess-race") });
		const sessionId = nextId("sess-race");
		const now = new Date().toISOString();

		await DB.insertInto("session")
			.values({
				id: sessionId,
				user_id: userId,
				game: "iidx-sp",
				name: "race session",
				description: null,
				time_inserted: now,
				time_started: now,
				time_ended: now,
				calculated_data: JSON.stringify({ marker: "initial" }),
				highlight: false,
			})
			.execute();

		const newerRun = await newCalculationRunStartedAt();
		const olderRun = new Date(Date.parse(newerRun) - 120_000).toISOString();

		let releaseStale!: () => void;
		const staleMayFinish = new Promise<void>((resolve) => {
			releaseStale = resolve;
		});

		await Promise.all([
			(async () => {
				await staleMayFinish;
				await DB.updateTable("session")
					.set({
						calculated_data: JSON.stringify({ marker: "stale" }),
						last_clean_started_at: olderRun,
					})
					.where("session.id", "=", sessionId)
					.where("session.last_clean_started_at", "<=", olderRun)
					.execute();
			})(),
			(async () => {
				await DB.updateTable("session")
					.set({
						calculated_data: JSON.stringify({ marker: "newer" }),
						last_clean_started_at: newerRun,
					})
					.where("session.id", "=", sessionId)
					.where("session.last_clean_started_at", "<=", newerRun)
					.execute();
				releaseStale();
			})(),
		]);

		const row = await DB.selectFrom("session")
			.select(["session.calculated_data", "session.last_clean_started_at"])
			.where("session.id", "=", sessionId)
			.executeTakeFirstOrThrow();

		expect((row.calculated_data as { marker: string }).marker).toBe("newer");
		expect(row.last_clean_started_at).toBe(newerRun);
	});

	it("parallel drainPbDirty workers fully drain without double-processing", async () => {
		const { id: userId } = await seedUser({ username: nextId("drain-race") });
		const chartIds = [nextId("c1"), nextId("c2"), nextId("c3")];

		for (const chartId of chartIds) {
			const songId = nextId(`song-${chartId}`);
			await seedIidxChart(chartId, songId);
			await insertCommittedScore({
				chartId,
				scoreId: nextId(`score-${chartId}`),
				userId,
				percent: 70 + chartIds.indexOf(chartId),
			});
		}

		const workerCount = 4;
		const processed = await runParallelUntilIdle(workerCount, drainPbDirty);

		expect(processed).toBe(chartIds.length);

		const remaining = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.execute();
		expect(remaining).toHaveLength(0);

		for (const chartId of chartIds) {
			expect(await readPbPercent(userId, chartId)).toBe(70 + chartIds.indexOf(chartId));
		}
	});

	it("drain ignores uncommitted scores even when pb_dirty row exists (staging race)", async () => {
		const { id: userId } = await seedUser({ username: nextId("staging-race") });
		const chartId = nextId("chart-staging");
		const songId = nextId("song-staging");
		const importId = nextId("import-staging");
		await seedIidxChart(chartId, songId);

		await insertCommittedScore({
			chartId,
			scoreId: nextId("score-committed"),
			userId,
			percent: 50,
		});

		await ProcessPBs("iidx-sp", userId, new Set([chartId]), log);
		expect(await readPbPercent(userId, chartId)).toBe(50);
		await clearPbDirtyForUser(userId, [chartId]);

		await insertUncommittedScore({
			chartId,
			importId,
			scoreId: nextId("score-staging"),
			userId,
			percent: 99,
		});

		const triggerDirty = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", chartId)
			.execute();
		expect(triggerDirty).toHaveLength(0);

		// Simulate the old bug: a dirty row exists while staging is still in flight.
		await DB.insertInto("pb_dirty").values({ user_id: userId, chart_id: chartId }).execute();

		await drainPbDirty();
		expect(await readPbPercent(userId, chartId)).toBe(50);

		await DB.updateTable("score")
			.set({ committed: true })
			.where("score.import_id", "=", importId)
			.execute();

		const afterCommitDirty = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", chartId)
			.execute();
		expect(afterCommitDirty).toHaveLength(1);

		await drainPbDirty();
		expect(await readPbPercent(userId, chartId)).toBe(99);
	});
});
