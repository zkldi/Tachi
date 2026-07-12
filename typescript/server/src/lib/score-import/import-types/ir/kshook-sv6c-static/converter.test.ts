import { log } from "#lib/log/log";
import { SongOrChartNotFoundFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import {
	TestingAlbidaADV,
	TestingKsHookSV6CStaticScore,
	TestingSDVXAlbidaSong,
} from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import { ConverterKsHookSV6CStatic } from "./converter";

async function seedAlbidaAdvKonaste() {
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

describe("ConverterKsHookSV6CStatic", () => {
	beforeEach(seedAlbidaAdvKonaste);

	it("matches score to song and chart", async () => {
		const res = await ConverterKsHookSV6CStatic(
			TestingKsHookSV6CStaticScore,
			{},
			"ir/kshook-sv6c-static",
			log,
		);

		expect(res.song.id).toBe(TestingSDVXAlbidaSong.id);
		expect(res.chart).toMatchObject({
			data: { inGameID: 1 },
			difficulty: "ADV",
		});
		expect(res.dryScore).toMatchObject({
			timeAchieved: TestingKsHookSV6CStaticScore.timestamp * 1000,
			game: "sdvx",
			importType: "ir/kshook-sv6c",
			service: "kshook SV6C Static",
			scoreData: {
				score: 9_579_365,
				lamp: "EXCESSIVE CLEAR",
				judgements: {},
				optional: {
					maxCombo: 158,
					exScore: 1334,
				},
			},
			scoreMeta: {},
		});
	});

	it("throws when chart is missing", async () => {
		await expect(
			ConverterKsHookSV6CStatic(
				{ ...TestingKsHookSV6CStaticScore, music_id: 10_000 },
				{},
				"ir/kshook-sv6c-static",
				log,
			),
		).rejects.toBeInstanceOf(SongOrChartNotFoundFailure);
	});
});
