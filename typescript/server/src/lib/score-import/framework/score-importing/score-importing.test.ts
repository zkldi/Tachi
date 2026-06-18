import type { DryScore } from "#lib/score-import/framework/common/types";

import { seedUser } from "#actions/test-utils/api-tokens";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InsertQueue } from "./insert-score";
import { ImportAllIterableData, ProcessSuccessfulConverterReturn } from "./score-importing";

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

describe("score-importing duplicate score ID regression", () => {
	/** Judgements must match EX score (pgreat*2 + great = score) for IIDX validation. */
	const duplicateDryScore: DryScore<"iidx-sp"> = {
		service: "test-import-dup",
		game: "iidx-sp",
		importType: "file/batch-manual",
		scoreMeta: {},
		timeAchieved: null,
		comment: null,
		scoreData: {
			score: 786,
			lamp: "CLEAR",
			judgements: {
				pgreat: 393,
				great: 0,
			},
			optional: {},
		},
	};

	const cfnReturn = {
		dryScore: duplicateDryScore,
		chart: Testing511SPA,
		song: Testing511Song,
	} as const;

	beforeEach(async () => {
		await seedUser({
			username: "test_zkldi",
			email: "score-import-dup@example.com",
			withCredential: true,
			withSettings: true,
		});
		await seed511Chart();
	});

	afterEach(async () => {
		await InsertQueue(1);
	});

	it("does not fail InsertQueue when the same score is seen again after a pipeline flush (DB already has the row)", async () => {
		const first = await ProcessSuccessfulConverterReturn(
			1,
			cfnReturn,
			[],
			log,
			"reg-flush-dup",
			{},
		);

		expect(first?.success).toBe(true);
		expect(await InsertQueue(1)).toBe(1);

		const second = await ProcessSuccessfulConverterReturn(
			1,
			cfnReturn,
			[],
			log,
			"reg-flush-dup",
			{},
		);
		expect(second).toBeNull();

		const flushAfterSkip = await InsertQueue(1);
		expect(flushAfterSkip).not.toBeNull();
		expect(flushAfterSkip).toBe(0);

		const rowCount = await DB.selectFrom("raw_score")
			.select((eb) => eb.fn.countAll().as("c"))
			.executeTakeFirst()
			.then((r) => Number(r?.c ?? 0));

		expect(rowCount).toBe(1);
	});

	it("ImportAllIterableData completes when two datapoints map to the same scoreID", async () => {
		const results = await ImportAllIterableData(
			1,
			duplicateDryScore.importType!,
			[0, 1],
			async () => cfnReturn,
			{},
			"iidx",
			log,
			undefined,
			"reg-iter-dup",
		);

		expect(results).toHaveLength(1);
		expect(results[0]?.success).toBe(true);

		const rowCount = await DB.selectFrom("raw_score")
			.select((eb) => eb.fn.countAll().as("c"))
			.executeTakeFirst()
			.then((r) => Number(r?.c ?? 0));

		expect(rowCount).toBe(1);
	});
});
