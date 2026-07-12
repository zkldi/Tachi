import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { Testing511Song, Testing511SPA } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import type { CGContext, CGIIDXScore } from "../types";

import { ConverterAPICGIIDX } from "./converter";

const LEG_SONG_ID = "s_cg_iidx_leg_test";
const LEG_CHART_ID = "c_cg_iidx_leg_test";

const iidxScore: CGIIDXScore = {
	version: 33,
	internalId: 1000,
	difficulty: "SPA",
	exScore: 1464,
	clearType: 4,
	perfectCount: 686,
	greatCount: 92,
	missCount: 8,
	dead: 0,
	ghost: "131316191818171a171717181817191617191718151913131917131717171817191818191818181918181a18181719171419171810141814191211161a131519",
	ghostGauge:
		"4c044c044c044c044c044c049a0402056a05060688060a075c071208940816096409b209000a340a9c0ad00a380bba0b560c8a0cbe0c0c0d740dc20d100e440eac0e140f620fb00ffe0f4c109a100211501191116112c9127f138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388138813881388135813721388138813881388138813881388138813de128813881388138813881388138813cc114e121113881388138813881388138813881388138813881388138813881388138813881300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
	option1: 72584948351232,
	option2: 0,
	dateTime: "2025-11-29 14:07:09",
};

const context: CGContext = {
	service: "dev",
	userID: 1,
};

async function seed511Another() {
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
			versions: ["33"],
			data: {
				inGameID: 24_011,
				notecount: 100,
				"2dxtraSet": null,
			},
		})
		.execute();
}

describe("ConverterAPICGIIDX", () => {
	it("returns song, chart, and dryScore for valid input", async () => {
		await seed511Another();

		const res = await ConverterAPICGIIDX(iidxScore, context, "api/cg-dev-iidx", log);

		expect(res.song).toMatchObject(Testing511Song);
		expect(res.chart).toMatchObject({
			chartID: Testing511SPA.chartID,
			difficulty: "ANOTHER",
		});
		expect(res.dryScore).toStrictEqual({
			comment: null,
			game: "iidx-sp",
			importType: "api/cg-dev-iidx",
			timeAchieved: 1764425229000,
			service: "CG Dev",
			scoreData: {
				score: 1464,
				lamp: "CLEAR",
				judgements: {
					pgreat: 686,
					great: 92,
				},
				optional: {
					bp: 8,
					gaugeHistory: [
						22, 22, 22, 22, 22, 22, 23.56, 25.64, 27.72, 30.84, 33.44, 36.04, 37.68,
						41.32, 43.92, 46.52, 48.08, 49.64, 51.2, 52.24, 54.32, 55.36, 57.44, 60.04,
						63.16, 64.2, 65.24, 66.8, 68.88, 70.44, 72, 73.04, 75.12, 77.2, 78.76,
						80.32, 81.88, 83.44, 85, 87.08, 88.64, 89.94, 94.1, 96.18, 99.82, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 99.04,
						99.56, 100, 100, 100, 100, 100, 100, 100, 100, 96.6, 100, 100, 100, 100,
						100, 100, 100, 91.12, 93.72, 97.62, 100, 100, 100, 100, 100, 100, 100, 100,
						100, 100, 100, 100, 100, 100, 100, 100,
					],
				},
			},
			scoreMeta: {
				random: "S-RANDOM",
			},
		});
	});

	it("converts legacy Leggendaria music_id via lookup table", async () => {
		await seed511Another();
		await seedLeggendariaFixture();

		const res = await ConverterAPICGIIDX(
			deepmerge(iidxScore, { internalId: 24101 } as Partial<CGIIDXScore>),
			context,
			"api/cg-dev-iidx",
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
		expect(sd.score).toBe(1464);
		expect(sd.lamp).toBe("CLEAR");
	});

	it("throws when chart is missing", async () => {
		await seed511Another();

		await expect(
			ConverterAPICGIIDX(
				deepmerge(iidxScore, { internalId: 0 } as Partial<CGIIDXScore>),
				context,
				"api/cg-dev-iidx",
				log,
			),
		).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Could not find chart with songID 0 \(iidx-sp ANOTHER - Version 33\)/u,
		});
	});

	it("rejects invalid music_id type", async () => {
		await seed511Another();

		await expect(
			ConverterAPICGIIDX(
				deepmerge(iidxScore, { internalId: "foo" }),
				context,
				"api/cg-dev-iidx",
				log,
			),
		).rejects.toMatchObject({
			message: expect.stringMatching(
				/.*invalid input syntax for type integer.*foo/iu,
			) as string,
		});
	});
});
