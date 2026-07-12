import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { TestingAlbidaADV, TestingSDVXAlbidaSong } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import type { SDVXEamusementCSVData } from "./types";

import ConvertEamSDVXCSV from "./converter";

const parsedScore = {
	title: "ALBIDA Powerless Mix",
	difficulty: "ADVANCED",
	level: "10",
	lamp: "EXCESSIVE COMPLETE",
	score: "9310699",
	exscore: "0",
};

async function seedAlbidaAdv() {
	await DB.insertInto("song")
		.values({
			id: TestingSDVXAlbidaSong.id,
			legacy_id: 1,
			game_group: "sdvx",
			title: TestingSDVXAlbidaSong.title,
			artist: TestingSDVXAlbidaSong.artist,
			search_terms: TestingSDVXAlbidaSong.searchTerms,
			alt_titles: TestingSDVXAlbidaSong.altTitles,
			data: TestingSDVXAlbidaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingAlbidaADV.chartID,
			legacy_id: TestingAlbidaADV.chartID,
			game: "sdvx",
			song_id: TestingSDVXAlbidaSong.id,
			difficulty: "ADV",
			level: TestingAlbidaADV.level,
			level_num: TestingAlbidaADV.levelNum,
			is_primary: TestingAlbidaADV.isPrimary,
			versions: TestingAlbidaADV.versions,
			data: TestingAlbidaADV.data,
		})
		.execute();
}

function conv(g: Partial<SDVXEamusementCSVData> = {}) {
	return ConvertEamSDVXCSV(deepmerge(parsedScore, g), {}, "file/eamusement-sdvx-csv", log);
}

describe("ConvertEamSDVXCSV", () => {
	it("returns song, chart, and dryScore for valid input", async () => {
		await seedAlbidaAdv();

		const res = await conv();

		expect(res.song).toMatchObject(TestingSDVXAlbidaSong);
		expect(res.chart).toMatchObject({
			chartID: TestingAlbidaADV.chartID,
			game: "sdvx",
			difficulty: "ADV",
		});
		expect(res.dryScore).toMatchObject({
			service: "e-amusement",
			game: "sdvx",
			scoreMeta: {},
			timeAchieved: null,
			comment: null,
			importType: "file/eamusement-sdvx-csv",
			scoreData: {
				score: 9310699,
				lamp: "EXCESSIVE CLEAR",
				judgements: {},
			},
		});
		expect((res.dryScore.scoreData.optional as { exScore?: number | null }).exScore).toBeNull();
	});

	it("includes exScore when non-zero", async () => {
		await seedAlbidaAdv();

		const res = await conv({ exscore: "5730" });

		expect(res.dryScore.scoreData.optional).toStrictEqual({ exScore: 5730 });
	});

	it("rejects invalid difficulty", async () => {
		await seedAlbidaAdv();

		await expect(conv({ difficulty: "INVALID" })).rejects.toMatchObject({
			message: expect.stringMatching(/Invalid difficulty of INVALID/u) as string,
		});
	});

	it("throws when the song is unknown", async () => {
		await seedAlbidaAdv();

		await expect(conv({ title: "INVALID SONG" })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Could not find song for INVALID SONG\./u,
		});
	});

	it("throws when the chart is unknown", async () => {
		await seedAlbidaAdv();

		await expect(conv({ difficulty: "VIVID" })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Could not find chart for ALBIDA Powerless Mix \[VVD\]\./u,
		});
	});

	// skipped
	// it("rejects incorrect level", async () => {
	// 	await seedAlbidaAdv();

	// 	await expect(conv({ level: "17" })).rejects.toMatchObject({
	// 		message: expect.stringMatching(/Should be level 10, but found level 17/u) as string,
	// 	});
	// });

	it("rejects invalid score", async () => {
		await seedAlbidaAdv();

		await expect(conv({ score: "not a number" })).rejects.toMatchObject({
			message: expect.stringMatching(/Invalid score of not a number/u) as string,
		});

		await expect(conv({ score: "10000001" })).rejects.toMatchObject({
			message: expect.stringMatching(
				/Invalid score of 10000001 \(was greater than 10,000,000\)/u,
			) as string,
		});
	});

	it("rejects invalid lamp", async () => {
		await seedAlbidaAdv();

		await expect(conv({ lamp: "INVALID" })).rejects.toMatchObject({
			message: expect.stringMatching(/Invalid lamp of INVALID/u) as string,
		});
	});
});
