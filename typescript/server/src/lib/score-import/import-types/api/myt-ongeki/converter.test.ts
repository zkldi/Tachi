import type { DeepPartial } from "#utils/types";

import { log } from "#lib/log/log";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import {
	OngekiBattleScoreRank,
	OngekiClearStatus,
	OngekiComboStatus,
	OngekiLevel,
	OngekiTechScoreRank,
} from "#proto/generated/ongeki/common_pb";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingOngekiChartConverter, TestingOngekiSong } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import type { MytOngekiScore } from "./types";

import ConvertAPIMytOngeki from "./converter";

const parsedScore = {
	playlogApiId: "806ca7ac-76f5-4d99-8760-770df60e1ff5",
	info: {
		musicId: 678,
		level: OngekiLevel.MASTER,
		techScore: 1003385,
		battleScore: 4987905,
		overDamage: 13151,
		techScoreRank: OngekiTechScoreRank.SS_PLUS,
		battleScoreRank: OngekiBattleScoreRank.GREAT,
		comboStatus: OngekiComboStatus.NONE,
		clearStatus: OngekiClearStatus.OVER_DAMAGE,
		isFullBell: true,
		isTechNewRecord: true,
		isBattleNewRecord: true,
		isOverDamageNewRecord: true,
		platinumScore: 893,
		userPlayDate: "2022-09-28T12:04:21.400Z",
	},
	judge: {
		judgeCriticalBreak: 967,
		judgeBreak: 19,
		judgeHit: 0,
		judgeMiss: 5,
		maxCombo: 525,
		bellCount: 174,
		totalBellCount: 174,
		damageCount: 0,
	},
} as MytOngekiScore;

async function seedOngekiConverterFixture() {
	await DB.insertInto("song")
		.values({
			id: TestingOngekiSong.id,
			legacy_id: 678,
			game_group: "ongeki",
			title: TestingOngekiSong.title,
			artist: TestingOngekiSong.artist,
			search_terms: TestingOngekiSong.searchTerms,
			alt_titles: TestingOngekiSong.altTitles,
			data: TestingOngekiSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingOngekiChartConverter.chartID,
			legacy_id: TestingOngekiChartConverter.chartID,
			game: "ongeki",
			song_id: TestingOngekiSong.id,
			difficulty: "MASTER",
			level: TestingOngekiChartConverter.level,
			level_num: TestingOngekiChartConverter.levelNum,
			is_primary: TestingOngekiChartConverter.isPrimary,
			versions: TestingOngekiChartConverter.versions,
			data: TestingOngekiChartConverter.data,
		})
		.execute();
}

describe("ConvertAPIMytOngeki", () => {
	beforeEach(seedOngekiConverterFixture);

	function convert(modifier: DeepPartial<MytOngekiScore> = {}) {
		return ConvertAPIMytOngeki(dmf(parsedScore, modifier), {}, "api/myt-ongeki", log);
	}

	it("returns song, chart, and dryScore for valid input", async () => {
		const res = await convert();

		expect(res).toStrictEqual({
			song: TestingOngekiSong,
			chart: TestingOngekiChartConverter,
			dryScore: {
				service: "MYT",
				game: "ongeki",
				scoreMeta: {},
				timeAchieved: ParseDateFromString("2022-09-28T12:04:21.400Z"),
				comment: null,
				importType: "api/myt-ongeki",
				scoreData: {
					score: 1003385,
					noteLamp: "CLEAR",
					bellLamp: "FULL BELL",
					platinumScore: 893,
					judgements: {
						cbreak: 967,
						break: 19,
						hit: 0,
						miss: 5,
					},
					optional: {
						damage: 0,
						bellCount: 174,
						totalBellCount: 174,
					},
				},
			},
		});
	});

	it("rejects unspecified difficulty", async () => {
		await expect(
			convert({
				info: {
					level: OngekiLevel.UNSPECIFIED,
				},
			}),
		).rejects.toMatchObject({
			message: expect.stringMatching(
				/Can't process a score with unspecified difficulty/u,
			) as string,
		});
	});

	it("maps note lamp from combo and clear status", async () => {
		await expect(
			convert({
				info: {
					comboStatus: OngekiComboStatus.ALL_BREAK,
					clearStatus: OngekiClearStatus.FAILED,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { noteLamp: "ALL BREAK" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: OngekiComboStatus.FULL_COMBO,
					clearStatus: OngekiClearStatus.FAILED,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { noteLamp: "FULL COMBO" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: OngekiComboStatus.NONE,
					clearStatus: OngekiClearStatus.OVER_DAMAGE,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { noteLamp: "CLEAR" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: OngekiComboStatus.NONE,
					clearStatus: OngekiClearStatus.CLEARED,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { noteLamp: "CLEAR" } },
		});

		await expect(
			convert({
				info: {
					comboStatus: OngekiComboStatus.NONE,
					clearStatus: OngekiClearStatus.FAILED,
				},
			}),
		).resolves.toMatchObject({
			dryScore: { scoreData: { noteLamp: "LOSS" } },
		});
	});

	it("rejects invalid combo/clear combination", async () => {
		await expect(
			convert({
				info: {
					clearStatus: OngekiClearStatus.UNSPECIFIED,
				},
			}),
		).rejects.toMatchObject({
			message: /Can't process a score with an invalid combo status and\/or clear status/u,
		});
	});

	it("throws when no chart matches", async () => {
		await expect(convert({ info: { musicId: 999999 } })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Can't find chart with id 999999 and difficulty MASTER/u,
		});
	});
});
