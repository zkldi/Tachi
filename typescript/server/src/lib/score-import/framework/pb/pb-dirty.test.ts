import { newCalculationRunStartedAt } from "#lib/dirty-queues/calculation-run";
import { log } from "#lib/log/log";
import { mongoScoreDataToPg, pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { GetChartForIDGuaranteed } from "#utils/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { type PgScoreData } from "tachi-common";
import { describe, expect, it } from "vitest";

import { CreatePBDoc } from "./create-pb-doc";
import { upsertPbFromMongoDoc } from "./upsert-pb-pg";

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
		.onConflict((oc) => oc.doNothing())
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
		.onConflict((oc) => oc.doNothing())
		.execute();
}

async function insertScoreRow(opts: {
	chartId: string;
	committed: boolean;
	importId?: string | null;
	percent?: number;
	scoreId: string;
	userId: number;
}) {
	const scoreData = {
		...TestingIIDXSPScore.scoreData,
		percent: opts.percent ?? TestingIIDXSPScore.scoreData.percent,
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
			committed: opts.committed,
		})
		.execute();
}

describe("pb_dirty trigger and last_clean_started_at guards", () => {
	it("does not enqueue pb_dirty for uncommitted score insert", async () => {
		const { id: userId } = await seedUser();
		await seedIidx511Chart();

		await insertScoreRow({
			chartId: Testing511SPA.chartID,
			scoreId: "score_uncommitted",
			userId,
			committed: false,
			importId: "import-staging-1",
		});

		const dirty = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", Testing511SPA.chartID)
			.execute();

		expect(dirty).toHaveLength(0);
	});

	it("enqueues pb_dirty for committed score insert", async () => {
		const { id: userId } = await seedUser();
		await seedIidx511Chart();

		await insertScoreRow({
			chartId: Testing511SPA.chartID,
			scoreId: "score_committed",
			userId,
			committed: true,
		});

		const dirty = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", Testing511SPA.chartID)
			.execute();

		expect(dirty).toHaveLength(1);
	});

	it("enqueues pb_dirty when a staged score is committed", async () => {
		const { id: userId } = await seedUser();
		await seedIidx511Chart();
		const importId = "import-commit-1";

		await insertScoreRow({
			chartId: Testing511SPA.chartID,
			scoreId: "score_staged",
			userId,
			committed: false,
			importId,
		});

		await DB.updateTable("score")
			.set({ committed: true })
			.where("score.id", "=", "score_staged")
			.execute();

		const dirty = await DB.selectFrom("pb_dirty")
			.selectAll()
			.where("pb_dirty.user_id", "=", userId)
			.where("pb_dirty.chart_id", "=", Testing511SPA.chartID)
			.execute();

		expect(dirty).toHaveLength(1);
	});

	it("skips pb upsert when a newer calculation run already wrote the row", async () => {
		const { id: userId } = await seedUser();
		await seedIidx511Chart();

		await insertScoreRow({
			chartId: Testing511SPA.chartID,
			scoreId: "score_calc_at",
			userId,
			committed: true,
			percent: 99,
		});

		const chart = await GetChartForIDGuaranteed(Testing511SPA.chartID);
		const newerRun = await newCalculationRunStartedAt();
		const pbDoc = await CreatePBDoc("iidx-sp", userId, chart, log);
		expect(pbDoc).toBeDefined();

		await DB.transaction().execute(async (trx) => {
			await upsertPbFromMongoDoc(trx, pbDoc!, newerRun);
		});

		const staleRun = new Date(Date.parse(newerRun) - 60_000).toISOString();
		const staleDoc = {
			...pbDoc!,
			scoreData: {
				...pbDoc!.scoreData,
				percent: 1,
			},
		};

		const applied = await DB.transaction().execute((trx) =>
			upsertPbFromMongoDoc(trx, staleDoc, staleRun),
		);

		expect(applied).toBe(false);

		const row = await DB.selectFrom("pb")
			.select(["pb.data", "pb.derived_data", "pb.judgements", "pb.last_clean_started_at"])
			.where("pb.user_id", "=", userId)
			.where("pb.chart_id", "=", Testing511SPA.chartID)
			.where("pb.lens", "is", null)
			.executeTakeFirstOrThrow();

		const scoreData = pgScoreDataToAPI("iidx-sp", {
			data: row.data,
			derived: row.derived_data,
			judgements: row.judgements,
		} as PgScoreData<"iidx-sp">);

		expect(scoreData.percent).toBe(99);
		expect(row.last_clean_started_at).toBe(newerRun);
	});
});
