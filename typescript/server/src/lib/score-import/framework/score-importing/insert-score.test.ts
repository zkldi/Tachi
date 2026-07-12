import DB from "#services/pg/db";
import { mkFakeScoreIIDXSP } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import { afterEach, describe, expect, it } from "vitest";

import { InsertQueue, QueueScoreInsert } from "./insert-score";

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

afterEach(async () => {
	await DB.deleteFrom("score").execute();
});

describe("QueueScoreInsert and InsertQueue", () => {
	it("queues one score and flushes into Postgres", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();
		const chart = Testing511SPA;

		const doc = mkFakeScoreIIDXSP({
			userID: userId,
			scoreID: "foo",
			chartID: chart.chartID,
		});

		const q = QueueScoreInsert(doc, chart, null, true);
		expect(q).toBe(true);

		const flushSize = await InsertQueue(userId);
		expect(flushSize).toBe(1);

		const rows = await DB.selectFrom("score").select("id").where("id", "=", "foo").execute();
		expect(rows).toHaveLength(1);
	});

	it("auto-flushes when the queue reaches 500 items", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();
		const chart = Testing511SPA;

		for (let i = 0; i < 499; i++) {
			const doc = mkFakeScoreIIDXSP({
				userID: userId,
				scoreID: `s-${i}`,
				chartID: chart.chartID,
			});
			expect(QueueScoreInsert(doc, chart, null, true)).toBe(true);
		}

		const overflowRes = await QueueScoreInsert(
			mkFakeScoreIIDXSP({
				userID: userId,
				scoreID: "foo",
				chartID: chart.chartID,
			}),
			chart,
			null,
			true,
		);

		expect(overflowRes).toBe(500);

		const flushRes = await InsertQueue(userId);
		expect(flushRes).toBe(0);

		const n = await DB.selectFrom("score")
			.select("id")
			.where("chart_id", "=", chart.chartID)
			.execute();
		expect(n).toHaveLength(500);
	});

	it("returns null when the same scoreID is queued twice", async () => {
		await seedIidx511Chart();
		const { id: userId } = await seedUser();
		const chart = Testing511SPA;

		const doc = mkFakeScoreIIDXSP({
			userID: userId,
			scoreID: "dup",
			chartID: chart.chartID,
		});

		expect(QueueScoreInsert(doc, chart, null, true)).toBe(true);
		expect(
			QueueScoreInsert(
				mkFakeScoreIIDXSP({
					userID: userId,
					scoreID: "dup",
					chartID: chart.chartID,
				}),
				chart,
				null,
				true,
			),
		).toBe(null);

		expect(await InsertQueue(userId)).toBe(1);

		const rows = await DB.selectFrom("score")
			.select("id")
			.where("chart_id", "=", chart.chartID)
			.execute();
		expect(rows).toHaveLength(1);
	});

	it("keeps separate queues per user", async () => {
		await seedIidx511Chart();
		const { id: u1 } = await seedUser({ username: `isq_u1_${Date.now()}` });
		const { id: u2 } = await seedUser({ username: `isq_u2_${Date.now()}` });
		const chart = Testing511SPA;

		expect(
			QueueScoreInsert(
				mkFakeScoreIIDXSP({ userID: u1, scoreID: "1", chartID: chart.chartID }),
				chart,
				null,
				true,
			),
		).toBe(true);
		expect(
			QueueScoreInsert(
				mkFakeScoreIIDXSP({ userID: u2, scoreID: "2", chartID: chart.chartID }),
				chart,
				null,
				true,
			),
		).toBe(true);

		expect(await InsertQueue(u1)).toBe(1);
		expect(await InsertQueue(u2)).toBe(1);
	});

	it("does not throw when flushing an empty queue", async () => {
		const { id: userId } = await seedUser({ username: `isq_empty_${Date.now()}` });
		await expect(InsertQueue(userId)).resolves.toBe(0);
	});
});
