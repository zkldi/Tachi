import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { MockMulterFile } from "#test-utils/mock-multer";
import { TestingWaccaMyPageScraperRecordsCSV } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import type { MyPageRecordsParsedPB } from "./types";

import { ParseMyPageScraperPlayerCSV, ParseMyPageScraperRecordsCSV } from "./parser";

describe("ParseMyPageScraperRecordsCSV", () => {
	it("parses the real records dump", () => {
		const file = MockMulterFile(TestingWaccaMyPageScraperRecordsCSV, "records.csv");
		const { iterable, gameGroup } = ParseMyPageScraperRecordsCSV(file, {}, log);

		expect(gameGroup).toBe("wacca");

		const iterableData = iterable as Array<MyPageRecordsParsedPB>;

		// Each line in the file corresponds to a song, not a chart. So one line
		// can have up to 4 PBs. There are more than 280 lines in the file, but
		// this includes songs that are never played. The actual number of
		// charts with (non-zero) PBs is 280.
		expect(iterableData.length).toBe(280);
	});

	it("parses a single-row CSV", () => {
		const buffer = Buffer.from(
			'music_id,music_title,music_artist,music_genre,music_levels,music_play_counts,music_scores,music_achieves\n3080,Avenue,aran,6,"[3,7+,12+,0]","[0,0,12]","[0,0,996952]","[0,0,3]"',
		);

		const file = MockMulterFile(buffer, "records.csv");

		const { iterable, gameGroup } = ParseMyPageScraperRecordsCSV(file, {}, log);

		expect(gameGroup).toBe("wacca");

		expect(iterable).toStrictEqual([
			{
				songId: 3080,
				songTitle: "Avenue",
				diffIndex: 2,
				level: "12+",
				score: 996952,
				lamp: 3,
			},
		]);
	});

	it("rejects malformed CSV rows", () => {
		const buffer = Buffer.from(
			'music_id,music_title,music_artist,music_genre,music_levels,music_play_counts,music_scores,music_achieves\nAvenue,aran,6,"[3,7+,12+,0]","[0,0,12]","[0,0,996952]","[0,0,3]"',
		);

		const file = MockMulterFile(buffer, "records.csv");

		expect(() => ParseMyPageScraperRecordsCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseMyPageScraperRecordsCSV(file, {}, log)).toThrow(
			"Failed to parse CSV: Invalid Record Length: columns length is 8, got 7 on line 2",
		);
	});

	it("rejects CSV with wrong headers", () => {
		const buffer = Buffer.from(
			'music_id,not_music_title,music_artist,music_genre,music_levels,music_play_counts,music_scores,music_achieves\n3080,Avenue,aran,6,"[3,7+,12+,0]","[0,0,12]","[0,0,996952]","[0,0,3]"',
		);

		const file = MockMulterFile(buffer, "records.csv");

		expect(() => ParseMyPageScraperRecordsCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseMyPageScraperRecordsCSV(file, {}, log)).toThrow(
			"Malformed CSV, invalid column(s) (music_title: undefined): Expected string.",
		);
	});

	it("rejects CSV with missing headers", () => {
		const buffer = Buffer.from(
			'music_id,music_title,music_levels,music_scores\n3080,Avenue,"[3,7+,12+,0]","[0,0,996952]"',
		);

		const file = MockMulterFile(buffer, "records.csv");

		expect(() => ParseMyPageScraperRecordsCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseMyPageScraperRecordsCSV(file, {}, log)).toThrow(
			"Malformed CSV, invalid column(s) (music_achieves: undefined): Expected string.",
		);
	});
});

describe("ParseMyPageScraperPlayerCSV", () => {
	it("parses player CSV and exposes a class provider", () => {
		const buffer = Buffer.from(
			'player_name,player_level,player_rate,player_stage,player_play_count,player_play_count_versus,player_play_count_coop,player_total_rp_earned,player_total_rp_spent\ncg505,120,2704,"[12,ステージXII,2]",1274,57,0,2088515,531325',
		);

		const file = MockMulterFile(buffer, "player.csv");

		const { iterable, gameGroup, classProvider } = ParseMyPageScraperPlayerCSV(file, {}, log);

		expect(gameGroup).toBe("wacca");

		expect(iterable).toStrictEqual([]);

		expect(classProvider).not.toBeNull();

		expect(classProvider!("wacca", 0, {}, log)).toStrictEqual({
			stageUp: "XII",
		});
	});

	it("rejects malformed player CSV", () => {
		const buffer = Buffer.from(
			'player_name,player_level,player_rate,player_stage,player_play_count,player_play_count_versus,player_play_count_coop,player_total_rp_earned,player_total_rp_spent\ncg505,2704,"[12,ステージXII,2]",1274,57,0,2088515,531325',
		);

		const file = MockMulterFile(buffer, "player.csv");

		expect(() => ParseMyPageScraperPlayerCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseMyPageScraperPlayerCSV(file, {}, log)).toThrow(
			"Failed to parse CSV: Invalid Record Length: columns length is 9, got 8 on line 2",
		);
	});

	it("rejects CSV missing player_stage", () => {
		const buffer = Buffer.from(
			"player_name,player_level,player_rate,player_play_count,player_play_count_versus,player_play_count_coop,player_total_rp_earned,player_total_rp_spent\ncg505,120,2704,1274,57,0,2088515,531325",
		);

		const file = MockMulterFile(buffer, "player.csv");

		expect(() => ParseMyPageScraperPlayerCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseMyPageScraperPlayerCSV(file, {}, log)).toThrow(
			"Malformed CSV: no player_stage column.",
		);
	});

	it("rejects malformed player_stage", () => {
		const buffer = Buffer.from('player_stage\n"[12,ステージXII]"');

		const file = MockMulterFile(buffer, "player.csv");

		expect(() => ParseMyPageScraperPlayerCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseMyPageScraperPlayerCSV(file, {}, log)).toThrow(
			"Malformed player_stage entry.",
		);
	});
});
