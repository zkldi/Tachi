import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { TestingWaccaPupaExp, TestingWaccaPupaSong } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import type { MyPageRecordsParsedPB } from "./types";

import ConvertMyPageScraperRecordsCSV from "./converter";

const parsedScore: MyPageRecordsParsedPB = {
	songId: 2085,
	songTitle: "PUPA",
	diffIndex: 2,
	level: "13+",
	score: 996827,
	lamp: 2,
};

async function seedPupaExpert() {
	await DB.insertInto("song")
		.values({
			id: TestingWaccaPupaSong.id,
			legacy_id: 2085,
			game_group: "wacca",
			title: TestingWaccaPupaSong.title,
			artist: TestingWaccaPupaSong.artist,
			search_terms: TestingWaccaPupaSong.searchTerms,
			alt_titles: TestingWaccaPupaSong.altTitles,
			data: TestingWaccaPupaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingWaccaPupaExp.chartID,
			legacy_id: TestingWaccaPupaExp.chartID,
			game: "wacca",
			song_id: TestingWaccaPupaSong.id,
			difficulty: "EXPERT",
			level: TestingWaccaPupaExp.level,
			level_num: TestingWaccaPupaExp.levelNum,
			is_primary: TestingWaccaPupaExp.isPrimary,
			versions: TestingWaccaPupaExp.versions,
			data: TestingWaccaPupaExp.data,
		})
		.execute();
}

function conv(g: Partial<MyPageRecordsParsedPB> = {}) {
	return ConvertMyPageScraperRecordsCSV(
		deepmerge(parsedScore, g),
		{},
		"file/mypagescraper-records-csv",
		log,
	);
}

describe("ConvertMyPageScraperRecordsCSV", () => {
	it("returns song, chart, and dryScore for valid input", async () => {
		await seedPupaExpert();

		const res = await conv();

		expect(res).toStrictEqual({
			song: TestingWaccaPupaSong,
			chart: TestingWaccaPupaExp,
			dryScore: {
				service: "mypage-scraper",
				game: "wacca",
				scoreMeta: {},
				timeAchieved: null,
				comment: null,
				importType: "file/mypagescraper-records-csv",
				scoreData: {
					score: 996827,
					lamp: "MISSLESS",
					judgements: {},
					optional: {},
				},
			},
		});
	});

	it("rejects out-of-range diffIndex", async () => {
		await seedPupaExpert();

		await expect(conv({ diffIndex: 4 })).rejects.toMatchObject({
			message: expect.stringMatching(/Invalid difficulty index of 4/u) as string,
		});
	});

	it("throws when the song is unknown", async () => {
		await seedPupaExpert();

		await expect(conv({ songTitle: "INVALID SONG" })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Could not find song for INVALID SONG\./u,
		});
	});

	it("rejects incorrect level", async () => {
		await seedPupaExpert();

		await expect(conv({ level: "12" })).rejects.toMatchObject({
			message: expect.stringMatching(
				/PUPA \[EXPERT\] - Should be level 13\+, but found level 12/u,
			) as string,
		});
	});
});
