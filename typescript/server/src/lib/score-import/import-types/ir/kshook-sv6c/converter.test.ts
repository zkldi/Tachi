import { log } from "#lib/log/log";
import { SongOrChartNotFoundFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import {
	TestingAlbidaADV,
	TestingKsHookSV6CScore,
	TestingSDVXAlbidaSong,
} from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import { ConverterIRKsHookSV6C } from "./converter";

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

describe("ConverterIRKsHookSV6C", () => {
	beforeEach(seedAlbidaAdvKonaste);

	it("matches score to song and chart", async () => {
		const res = await ConverterIRKsHookSV6C(
			TestingKsHookSV6CScore,
			{ timeReceived: 10 },
			"ir/kshook-sv6c",
			log,
		);

		expect(res.song.id).toBe(TestingSDVXAlbidaSong.id);
		expect(res.chart).toMatchObject({
			data: { inGameID: 1 },
			difficulty: "ADV",
		});
		expect(res.dryScore).toMatchObject({
			game: "sdvx",
			importType: "ir/kshook-sv6c",
			service: "kshook SV6C",
			comment: null,
			timeAchieved: 10,
			scoreData: {
				score: 9_579_365,
				lamp: "EXCESSIVE CLEAR",
				judgements: {
					critical: 1184,
					near: 46,
					miss: 30,
				},
				optional: {
					maxCombo: 158,
					exScore: 1334,
					gauge: 0.71,
				},
			},
			scoreMeta: {},
		});
	});

	it("throws when chart is missing", async () => {
		await expect(
			ConverterIRKsHookSV6C(
				{ ...TestingKsHookSV6CScore, music_id: 10_000 },
				{ timeReceived: 10 },
				"ir/kshook-sv6c",
				log,
			),
		).rejects.toBeInstanceOf(SongOrChartNotFoundFailure);
	});
});
