import type { ScoreData } from "tachi-common";

import { type KtLogger, log } from "#lib/log/log";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { describe, expect, it, vi } from "vitest";

import type { PBScoreDocumentNoRank } from "./upsert-pb-pg";

import { CreatePBDoc } from "./create-pb-doc";

async function seedTesting511IidxSongAndChart() {
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

async function insertIidx511SpScore(opts: {
	mongo: ScoreData<"iidx-sp">;
	scoreId: string;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", {
		...opts.mongo,
		judgements: opts.mongo.judgements ?? {},
	});
	const ts = UnixMillisecondsToISO8601(opts.timeMs);
	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: Testing511SPA.chartID,
			game: "iidx-sp",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({}),
			time_achieved: ts,
			time_added: ts,
			highlight: false,
			comment: null,
			committed: true,
		})
		.execute();
}

describe("CreatePBDoc", () => {
	it("returns undefined and logs when the user has no scores on the chart", async () => {
		await seedTesting511IidxSongAndChart();

		const { id: userId } = await seedUser();

		const warn = vi.fn();
		const fakeLogger = { warn } as unknown as KtLogger;

		const res = await CreatePBDoc("iidx-sp", userId, Testing511SPA, fakeLogger);

		expect(res).toBeUndefined();
		expect(warn).toHaveBeenCalled();
	});

	it("composes iidx PB: best lamp and lowest BP are merged onto the primary (percent-best) score", async () => {
		await seedTesting511IidxSongAndChart();

		const { id: userId } = await seedUser();

		// Primary metric for IIDX PBs is percent; higher percent must be on the EXHC run so score 1926 is the base.
		await insertIidx511SpScore({
			userId,
			scoreId: "create-pb-doc-iidx-exhc",
			timeMs: 1_000_000,
			mongo: {
				grade: "AAA",
				lamp: "EX HARD CLEAR",
				percent: 95,
				score: 1926,
				optional: { bp: 3 },
				judgements: {},
			} as ScoreData<"iidx-sp">,
		});

		await insertIidx511SpScore({
			userId,
			scoreId: "create-pb-doc-iidx-assist",
			timeMs: 2_000_000,
			mongo: {
				grade: "AA",
				lamp: "ASSIST CLEAR",
				percent: 70,
				score: 1039,
				optional: { bp: 38 },
				judgements: {},
			} as ScoreData<"iidx-sp">,
		});

		const pb = (await CreatePBDoc("iidx-sp", userId, Testing511SPA, log)) as
			| PBScoreDocumentNoRank<"iidx-sp">
			| undefined;

		expect(pb).toBeDefined();
		expect(pb!.scoreData.score).toBe(1926);
		expect(pb!.scoreData.lamp).toBe("EX HARD CLEAR");
		expect(pb!.scoreData.optional.bp).toBe(3);
	});

	it("merges best lamp from a lower-percent HARD CLEAR onto the EASY CLEAR primary", async () => {
		await seedTesting511IidxSongAndChart();

		const { id: userId } = await seedUser();

		await insertIidx511SpScore({
			userId,
			scoreId: "create-pb-doc-iidx-hard",
			timeMs: 1_000_000,
			mongo: {
				grade: "A",
				lamp: "HARD CLEAR",
				percent: 85,
				score: 1920,
				optional: { bp: 2 },
				judgements: {},
			} as ScoreData<"iidx-sp">,
		});

		await insertIidx511SpScore({
			userId,
			scoreId: "create-pb-doc-iidx-easy",
			timeMs: 2_000_000,
			mongo: {
				grade: "AAA",
				lamp: "EASY CLEAR",
				percent: 92,
				score: 2040,
				optional: { bp: 20 },
				judgements: {},
			} as ScoreData<"iidx-sp">,
		});

		const pb = (await CreatePBDoc("iidx-sp", userId, Testing511SPA, log)) as
			| PBScoreDocumentNoRank<"iidx-sp">
			| undefined;

		expect(pb).toBeDefined();
		expect(pb!.scoreData.score).toBe(2040);
		expect(pb!.scoreData.lamp).toBe("HARD CLEAR");
		expect(pb!.scoreData.optional.bp).toBe(2);
	});
});
