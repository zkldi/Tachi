import { DeorphanBmsIfInOrphanChartPg } from "#lib/orphan-queue/deorphan-bms-pg";
import DB from "#services/pg/db";
import { CreateChartID } from "tachi-common";
import { afterEach, describe, expect, it } from "vitest";

describe("DeorphanBmsIfInOrphanChartPg", () => {
	let orphanChartId: string | undefined;

	afterEach(async () => {
		const id = orphanChartId;
		orphanChartId = undefined;

		if (!id) {
			return;
		}

		const chartRow = await DB.selectFrom("chart")
			.select("song_id")
			.where("id", "=", id)
			.executeTakeFirst();

		await DB.deleteFrom("chart").where("id", "=", id).execute();

		if (chartRow) {
			await DB.deleteFrom("song").where("id", "=", chartRow.song_id).execute();
		}

		await DB.deleteFrom("orphan_chart_user").where("orphan_chart_id", "=", id).execute();
		await DB.deleteFrom("orphan_chart").where("id", "=", id).execute();
	});

	it("moves a matching orphan into song/chart and removes the orphan row", async () => {
		orphanChartId = CreateChartID();
		const md5 = "a".repeat(32);

		await DB.insertInto("orphan_chart")
			.values({
				id: orphanChartId,
				game: "bms-7k",
				chart_doc: {
					chartID: orphanChartId,
					difficulty: "CHART",
					isPrimary: true,
					level: "?",
					levelNum: 0,
					playtype: "7K",
					songID: 0,
					versions: [],
					data: {
						hashMD5: md5,
						hashSHA256: "b".repeat(64),
						notecount: 100,
						tableFolders: {},
						aiLevel: null,
						sglEC: null,
						sglHC: null,
					},
				},
				song_doc: {
					artist: "artist",
					title: "title",
					id: 0,
					altTitles: [],
					searchTerms: [],
					data: {
						genre: null,
						subartist: null,
						subtitle: null,
						tableString: null,
					},
				},
			})
			.execute();

		const chart = await DeorphanBmsIfInOrphanChartPg("bms-7k", "md5", md5);

		expect(chart).not.toBeNull();
		expect(chart!.chartID).toBe(orphanChartId);

		const orphan = await DB.selectFrom("orphan_chart")
			.select("id")
			.where("id", "=", orphanChartId)
			.executeTakeFirst();

		expect(orphan).toBeUndefined();

		const chartRow = await DB.selectFrom("chart")
			.select("id")
			.where("id", "=", orphanChartId)
			.executeTakeFirst();

		expect(chartRow).toBeDefined();
	});
});
