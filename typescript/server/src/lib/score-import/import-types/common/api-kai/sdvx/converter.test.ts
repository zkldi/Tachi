import { log } from "#lib/log/log";
import { InvalidScoreFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import { TestingAlbidaADV, TestingSDVXAlbidaSong } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import { ConvertAPIKaiSDVX, ConvertDifficulty, ConvertVersion, ResolveKaiLamp } from "./converter";

const sdvxScore = {
	sdvx_id: 32157055,
	music_id: 1,
	music_difficulty: 1,
	played_version: 6,
	clear_type: 2,
	max_chain: 179,
	score: 9310699,
	critical: 1754,
	near: 112,
	error: 78,
	early: 70,
	late: 42,
	gauge_type: 0,
	gauge_rate: 90.01,
	timestamp: "2020-08-30T13:08:11Z",
	_id: 127108,
};

async function seedAlbidaAdvExceed() {
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

describe("ConvertAPIKaiSDVX", () => {
	beforeEach(seedAlbidaAdvExceed);

	it("returns song, chart, and dryScore for valid input", async () => {
		const res = await ConvertAPIKaiSDVX(sdvxScore, { service: "FLO" }, "api/flo-sdvx", log);

		expect(res.song).toMatchObject({ id: TestingSDVXAlbidaSong.id });
		expect(res.chart).toMatchObject({
			difficulty: "ADV",
			data: { inGameID: 1 },
		});
		expect(res.dryScore).toStrictEqual({
			comment: null,
			game: "sdvx",
			importType: "api/flo-sdvx",
			timeAchieved: 1598792891000,
			service: "FLO",
			scoreData: {
				score: 9310699,
				lamp: "CLEAR",
				judgements: {
					critical: 1754,
					near: 112,
					miss: 78,
				},
				optional: {
					fast: 70,
					slow: 42,
					gauge: 90.01,
					maxCombo: 179,
				},
			},
			scoreMeta: {},
		});
	});

	it("throws when chart is missing", async () => {
		await expect(
			ConvertAPIKaiSDVX(
				deepmerge(sdvxScore, { music_id: 0 }),
				{ service: "FLO" },
				"api/flo-sdvx",
				log,
			),
		).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Could not find chart with songID 0 \(ADV - Version exceed\)/u,
		});
	});

	it("rejects invalid music_id type", async () => {
		await expect(
			ConvertAPIKaiSDVX(
				deepmerge(sdvxScore, { music_id: "foo" }),
				{ service: "FLO" },
				"api/flo-sdvx",
				log,
			),
		).rejects.toMatchObject({
			message: expect.stringMatching(
				/music_id.*Expected a positive integer.*foo/iu,
			) as string,
		});
	});
});

describe("ConvertDifficulty (Kai SDVX)", () => {
	it("maps difficulty indices", () => {
		expect(ConvertDifficulty(0)).toBe("NOV");
		expect(ConvertDifficulty(1)).toBe("ADV");
		expect(ConvertDifficulty(2)).toBe("EXH");
		expect(ConvertDifficulty(3)).toBe("ANY_INF");
		expect(ConvertDifficulty(4)).toBe("MXM");
		expect(ConvertDifficulty(5)).toBe("ULT");
		expect(() => ConvertDifficulty(6)).toThrow(InvalidScoreFailure);
	});
});

describe("ConvertVersion (Kai SDVX)", () => {
	it("maps version indices", () => {
		expect(ConvertVersion(1)).toBe("booth");
		expect(ConvertVersion(2)).toBe("inf");
		expect(ConvertVersion(3)).toBe("gw");
		expect(ConvertVersion(4)).toBe("heaven");
		expect(ConvertVersion(5)).toBe("vivid");
		expect(ConvertVersion(6)).toBe("exceed");
		expect(() => ConvertVersion(7)).toThrow(InvalidScoreFailure);
		expect(() => ConvertVersion(0)).toThrow(InvalidScoreFailure);
	});
});

describe("ResolveKaiLamp (SDVX)", () => {
	it("maps clear_type to lamp", () => {
		expect(ResolveKaiLamp(1)).toBe("FAILED");
		expect(ResolveKaiLamp(2)).toBe("CLEAR");
		expect(ResolveKaiLamp(3)).toBe("EXCESSIVE CLEAR");
		expect(ResolveKaiLamp(4)).toBe("ULTIMATE CHAIN");
		expect(ResolveKaiLamp(5)).toBe("PERFECT ULTIMATE CHAIN");
		expect(ResolveKaiLamp(6)).toBe("MAXXIVE CLEAR");
		expect(() => ResolveKaiLamp(7)).toThrow(InvalidScoreFailure);
		expect(() => ResolveKaiLamp(0)).toThrow(InvalidScoreFailure);
	});
});
