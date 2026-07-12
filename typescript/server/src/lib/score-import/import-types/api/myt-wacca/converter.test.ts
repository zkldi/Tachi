import { log } from "#lib/log/log";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import {
	WaccaMusicDifficulty,
	WaccaMusicScoreGrade,
	WaccaPlayMode,
} from "#proto/generated/wacca/common_pb";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingWaccaPupaExp, TestingWaccaPupaSong } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import type { MytWaccaScore } from "./types";

import ConvertAPIMytWACCA from "./converter";

const parsedScore = {
	musicId: 2085,
	musicDifficulty: WaccaMusicDifficulty.EXPERT,
	score: 996827,
	grade: WaccaMusicScoreGrade.SSS_PLUS,
	judge: {
		marvelous: 909,
		great: 4,
		good: 1,
		miss: 1,
	},
	clearStatus: {
		isClear: true,
		isMissless: true,
		isFullCombo: false,
		isAllMarvelous: false,
		isGiveUp: false,
	},
	isNewRecord: false,
	combo: 408,
	skillPoints: 0,
	fast: 4,
	late: 1,
	userPlayMode: WaccaPlayMode.SINGLE,
	track: 1,
	userPlayDate: "2024-03-23T19:34:10.350+00:00",
} as MytWaccaScore;

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

describe("ConvertAPIMytWACCA", () => {
	beforeEach(seedPupaExpert);

	function conv(g: Partial<MytWaccaScore> = {}) {
		return ConvertAPIMytWACCA(dmf(parsedScore, g), {}, "api/myt-wacca", log);
	}

	it("returns song, chart, and dryScore for valid input", async () => {
		const res = await conv();

		expect(res).toStrictEqual({
			song: TestingWaccaPupaSong,
			chart: TestingWaccaPupaExp,
			dryScore: {
				service: "MYT",
				game: "wacca",
				scoreMeta: {},
				timeAchieved: ParseDateFromString("2024-03-23 19:34:10.350 UTC"),
				comment: null,
				importType: "api/myt-wacca",
				scoreData: {
					score: 996827,
					lamp: "MISSLESS",
					judgements: {
						marvelous: 909,
						great: 4,
						good: 1,
						miss: 1,
					},
					optional: {
						fast: 4,
						slow: 1,
						maxCombo: 408,
					},
				},
			},
		});
	});

	it("rejects unspecified difficulty", async () => {
		await expect(
			conv({ musicDifficulty: WaccaMusicDifficulty.UNSPECIFIED }),
		).rejects.toMatchObject({
			message: expect.stringMatching(
				/Can't process a score with unspecified difficulty/u,
			) as string,
		});
	});

	it("rejects missing clearStatus", async () => {
		const data = dmf(parsedScore, {});
		delete data.clearStatus;

		await expect(ConvertAPIMytWACCA(data, {}, "api/myt-wacca", log)).rejects.toMatchObject({
			message: /Can't process a score without clearStatus/u,
		});
	});

	it("throws when no chart matches musicId and difficulty", async () => {
		await expect(conv({ musicId: 999999 })).rejects.toMatchObject({
			failureType: "SongOrChartNotFound",
			message: /Can't find chart with id 999999 and difficulty EXPERT/u,
		});
	});
});
