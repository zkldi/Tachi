import type { DeepPartial } from "#utils/types";

import { log } from "#lib/log/log";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import {
	MaimaiComboStatus,
	MaimaiLevel,
	MaimaiScoreRank,
	MaimaiSyncStatus,
} from "#proto/generated/maimai/common_pb";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingMaimaiDXChartConverter, TestingMaimaiDXSongConverter } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import type { MytMaimaiDxScore } from "./types";

import ConvertAPIMytMaimaiDx from "./converter";

const parsedScore = {
	playlogApiId: "6071c489-6ab9-4674-a443-f88b603fa596",
	info: {
		musicId: 11294,
		level: MaimaiLevel.EXPERT,
		achievement: 990562,
		deluxscore: 1825,
		scoreRank: MaimaiScoreRank.SS,
		comboStatus: MaimaiComboStatus.NONE,
		syncStatus: MaimaiSyncStatus.NONE,
		isClear: true,
		isAchieveNewRecord: true,
		isDeluxscoreNewRecord: true,
		track: 1,
		userPlayDate: "2022-11-03T04:21:05.000+09:00",
	},
	judge: {
		judgeCriticalPerfect: 10,
		judgePerfect: 656,
		judgeGreat: 19,
		judgeGood: 1,
		judgeMiss: 8,
		maxCombo: 279,
		fastCount: 5,
		lateCount: 8,
	},
} as MytMaimaiDxScore;

async function seedMaimaiDxConverterFixture() {
	await DB.insertInto("song")
		.values({
			id: TestingMaimaiDXSongConverter.id,
			legacy_id: 11294,
			game_group: "maimaidx",
			title: TestingMaimaiDXSongConverter.title,
			artist: TestingMaimaiDXSongConverter.artist,
			search_terms: TestingMaimaiDXSongConverter.searchTerms,
			alt_titles: TestingMaimaiDXSongConverter.altTitles,
			data: TestingMaimaiDXSongConverter.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingMaimaiDXChartConverter.chartID,
			legacy_id: TestingMaimaiDXChartConverter.chartID,
			game: "maimaidx",
			song_id: TestingMaimaiDXSongConverter.id,
			difficulty: "DX Expert",
			level: TestingMaimaiDXChartConverter.level,
			level_num: TestingMaimaiDXChartConverter.levelNum,
			is_primary: TestingMaimaiDXChartConverter.isPrimary,
			versions: TestingMaimaiDXChartConverter.versions,
			data: TestingMaimaiDXChartConverter.data,
		})
		.execute();
}

describe("ConvertAPIMytMaimaiDx", () => {
	beforeEach(seedMaimaiDxConverterFixture);

	function convert(modifier: DeepPartial<MytMaimaiDxScore> = {}) {
		return ConvertAPIMytMaimaiDx(dmf(parsedScore, modifier), {}, "api/myt-maimaidx", log);
	}

	it("returns song, chart, and dryScore for valid input", async () => {
		const res = await convert();

		expect(res).toStrictEqual({
			song: TestingMaimaiDXSongConverter,
			chart: TestingMaimaiDXChartConverter,
			dryScore: {
				service: "MYT",
				game: "maimaidx",
				scoreMeta: {},
				timeAchieved: ParseDateFromString("2022-11-03T04:21:05.000+09:00"),
				comment: null,
				importType: "api/myt-maimaidx",
				scoreData: {
					percent: 99.0562,
					lamp: "CLEAR",
					judgements: {
						pcrit: 10,
						perfect: 656,
						great: 19,
						good: 1,
						miss: 8,
					},
					optional: {
						fast: 5,
						slow: 8,
						maxCombo: 279,
					},
				},
			},
		});
	});

	it("rejects Utage charts", async () => {
		await expect(
			convert({
				info: {
					musicId: 8032,
					level: MaimaiLevel.UTAGE,
				},
			}),
		).rejects.toMatchObject({
			failureType: "SkipScore",
			message: /Utage charts are not supported/u,
		});
	});

	it("rejects unspecified difficulty", async () => {
		await expect(
			convert({
				info: {
					level: MaimaiLevel.UNSPECIFIED,
				},
			}),
		).rejects.toMatchObject({
			message: expect.stringMatching(
				/Can't process a score with unspecified difficulty/u,
			) as string,
		});
	});

	it("maps lamp from combo status and clear flag", async () => {
		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.ALL_PERFECT_PLUS,
					isClear: true,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "ALL PERFECT+" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.ALL_PERFECT,
					isClear: true,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "ALL PERFECT" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.FULL_COMBO_PLUS,
					isClear: true,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "FULL COMBO+" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.FULL_COMBO,
					isClear: true,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "FULL COMBO" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.NONE,
					isClear: true,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "CLEAR" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.NONE,
					isClear: false,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "FAILED" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: MaimaiComboStatus.FULL_COMBO,
					isClear: false,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "FAILED" } },
		});
	});

	it("throws when no chart matches", async () => {
		await expect(
			convert({
				info: { musicId: 999999, level: MaimaiLevel.MASTER },
			}),
		).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Can't find chart with id 999999 and difficulty DX Master/u,
		});
	});
});
