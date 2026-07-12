import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import { ConvertAPIKaiIIDX } from "./converter";

const LEG_SONG_ID = "s_kai_iidx_leg_test";
const LEG_CHART_ID = "c_kai_iidx_leg_test";

const iidxScore = {
	chart_id: 3848,
	music_id: 1000,
	music_difficulty: 2,
	play_style: "SINGLE",
	difficulty: "ANOTHER",
	iidx_id: 35247879,
	version_played: 26,
	lamp: 5,
	ex_score: 1570,
	grade: "AA",
	miss_count: 24,
	fast_count: null,
	slow_count: null,
	timestamp: "2020-10-31T19:10:50Z",
	_id: 189232,
};

async function seed511Another26() {
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
			difficulty: "ANOTHER",
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: Testing511SPA.data,
		})
		.execute();
}

async function seedLeggendariaFixture() {
	await DB.insertInto("song")
		.values({
			id: LEG_SONG_ID,
			legacy_id: 24_011,
			game_group: "iidx",
			title: "冬椿 ft. Kanae Asaba",
			artist: "artist",
			search_terms: [],
			alt_titles: [],
			data: { displayVersion: "1", genre: "TEST" },
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: LEG_CHART_ID,
			legacy_id: LEG_CHART_ID,
			game: "iidx-sp",
			song_id: LEG_SONG_ID,
			difficulty: "LEGGENDARIA",
			level: "12",
			level_num: 12,
			is_primary: true,
			versions: ["26"],
			data: {
				inGameID: 24_011,
				notecount: 100,
				"2dxtraSet": null,
			},
		})
		.execute();
}

describe("ConvertAPIKaiIIDX", () => {
	it("returns song, chart, and dryScore for valid input", async () => {
		await seed511Another26();

		const res = await ConvertAPIKaiIIDX(iidxScore, { service: "FLO" }, "api/flo-iidx", log);

		expect(res.song).toMatchObject(Testing511Song);
		expect(res.chart).toMatchObject({
			chartID: Testing511SPA.chartID,
			difficulty: "ANOTHER",
		});
		expect(res.dryScore).toStrictEqual({
			comment: null,
			game: "iidx-sp",
			importType: "api/flo-iidx",
			timeAchieved: 1604171450000,
			service: "FLO",
			scoreData: {
				score: 1570,
				lamp: "HARD CLEAR",
				judgements: {},
				optional: {
					fast: null,
					slow: null,
					bp: 24,
				},
			},
			scoreMeta: {},
		});
	});

	it("converts legacy Leggendaria music_id via lookup table", async () => {
		await seed511Another26();
		await seedLeggendariaFixture();

		const res = await ConvertAPIKaiIIDX(
			deepmerge(iidxScore, { music_id: 24101 }),
			{ service: "FLO" },
			"api/flo-iidx",
			log,
		);

		expect(res.song).toMatchObject({ title: "冬椿 ft. Kanae Asaba" });
		expect(res.chart).toMatchObject({
			difficulty: "LEGGENDARIA",
			data: {
				inGameID: 24_011,
			},
		});
		expect(res.dryScore.game).toBe("iidx-sp");
		const sd = res.dryScore.scoreData as { lamp: string; score: number };
		expect(sd.score).toBe(1570);
		expect(sd.lamp).toBe("HARD CLEAR");
	});

	it("throws when chart is missing", async () => {
		await seed511Another26();

		await expect(
			ConvertAPIKaiIIDX(
				deepmerge(iidxScore, { music_id: 0 }),
				{ service: "FLO" },
				"api/flo-iidx",
				log,
			),
		).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Could not find chart with songID 0 \(iidx-sp ANOTHER - Version 26\)/u,
		});
	});

	it("rejects invalid music_id type", async () => {
		await seed511Another26();

		await expect(
			ConvertAPIKaiIIDX(
				deepmerge(iidxScore, { music_id: "foo" }),
				{ service: "FLO" },
				"api/flo-iidx",
				log,
			),
		).rejects.toMatchObject({
			message: expect.stringMatching(
				/music_id.*Expected a positive integer.*foo/iu,
			) as string,
		});
	});
});
