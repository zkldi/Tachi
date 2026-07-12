import { log } from "#lib/log/log";
import { SongOrChartNotFoundFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { BMSGazerChart, BMSGazerSong, TestingLR2HookScore } from "#test-utils/test-data";
import { ApplyNTimes } from "#utils/misc";
import { beforeEach, describe, expect, it } from "vitest";

import { ConverterLR2Hook } from "./converter";

async function seedGazerChart() {
	await DB.insertInto("song")
		.values({
			id: BMSGazerSong.id,
			legacy_id: 27_339,
			game_group: "bms",
			title: BMSGazerSong.title,
			artist: BMSGazerSong.artist,
			search_terms: BMSGazerSong.searchTerms,
			alt_titles: BMSGazerSong.altTitles,
			data: BMSGazerSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: BMSGazerChart.chartID,
			legacy_id: BMSGazerChart.chartID,
			game: "bms-7k",
			song_id: BMSGazerSong.id,
			difficulty: "CHART",
			level: BMSGazerChart.level,
			level_num: BMSGazerChart.levelNum,
			is_primary: BMSGazerChart.isPrimary,
			versions: BMSGazerChart.versions,
			data: BMSGazerChart.data,
		})
		.execute();
}

describe("ConverterLR2Hook", () => {
	beforeEach(seedGazerChart);

	it("matches score to song and chart", async () => {
		const res = await ConverterLR2Hook(
			TestingLR2HookScore,
			{ timeReceived: 10_000 },
			"ir/lr2hook",
			log,
		);

		expect(res.song.id).toBe(BMSGazerSong.id);
		expect(res.chart.chartID).toBe(BMSGazerChart.chartID);
		expect(res.chart.data).toMatchObject({
			hashMD5: TestingLR2HookScore.md5,
		});
		expect(res.dryScore).toMatchObject({
			game: "bms-7k",
			importType: "ir/lr2hook",
			service: "LR2Hook",
			comment: null,
			timeAchieved: 10_000,
			scoreData: {
				score: TestingLR2HookScore.scoreData.exScore,
				lamp: "HARD CLEAR",
				judgements: {
					pgreat: TestingLR2HookScore.scoreData.pgreat,
					great: TestingLR2HookScore.scoreData.great,
					good: TestingLR2HookScore.scoreData.good,
					bad: TestingLR2HookScore.scoreData.bad,
					poor: TestingLR2HookScore.scoreData.poor,
				},
				optional: {
					bp: 56,
					maxCombo: TestingLR2HookScore.scoreData.maxCombo,
				},
			},
			scoreMeta: {
				client: "LR2",
				gauge: "NORMAL",
				random: "RANDOM",
			},
		});
		expect(
			(res.dryScore.scoreData.optional as { gaugeHistory: unknown }).gaugeHistory,
		).toHaveLength(1000);
	});

	it("includes extended judgements and selected HP graph series", async () => {
		const res = await ConverterLR2Hook(
			dmf(TestingLR2HookScore, {
				scoreData: {
					extendedJudgements: {
						epg: 1,
						lpg: 2,
						egr: 3,
						lgr: 4,
						egd: 5,
						lgd: 6,
						ebd: 7,
						lbd: 8,
						epr: 9,
						lpr: 10,
						cb: 11,
						fast: 12,
						slow: 13,
						notesPlayed: TestingLR2HookScore.scoreData.notesPlayed,
					},
					extendedHpGraphs: {
						groove: ApplyNTimes(1000, () => 1),
						hard: ApplyNTimes(1000, () => 2),
						hazard: ApplyNTimes(1000, () => 3),
						easy: ApplyNTimes(1000, () => 4),
						pattack: ApplyNTimes(1000, () => 5),
						gattack: ApplyNTimes(1000, () => 6),
					},
				},
				unixTimestamp: 8,
			} as { unixTimestamp: number } & typeof TestingLR2HookScore),
			{ timeReceived: 10_000 },
			"ir/lr2hook",
			log,
		);

		expect(res.song.id).toBe(BMSGazerSong.id);
		expect(res.chart.data).toMatchObject({ hashMD5: TestingLR2HookScore.md5 });
		expect(res.dryScore.timeAchieved).toBe(8000);
		expect(res.dryScore.scoreData.optional).toMatchObject({
			bp: 56,
			epg: 1,
			lpg: 2,
			egr: 3,
			lgr: 4,
			egd: 5,
			lgd: 6,
			ebd: 7,
			lbd: 8,
			epr: 9,
			lpr: 10,
			fast: 12,
			slow: 13,
			gaugeHistoryGroove: ApplyNTimes(1000, () => 1),
			gaugeHistoryHard: ApplyNTimes(1000, () => 2),
			gaugeHistoryEasy: ApplyNTimes(1000, () => 4),
		});
	});

	it("nulls BP when the chart was exited early", async () => {
		const res = await ConverterLR2Hook(
			dmf(TestingLR2HookScore, {
				scoreData: {
					notesPlayed: TestingLR2HookScore.scoreData.notesTotal - 1,
				},
			} as typeof TestingLR2HookScore),
			{ timeReceived: 10 },
			"ir/lr2hook",
			log,
		);

		expect(res.song.id).toBe(BMSGazerSong.id);
		expect((res.dryScore.scoreData.optional as { bp: number | null }).bp).toBeNull();
	});

	it("computes BP from extendedJudgements when exited early", async () => {
		const res = await ConverterLR2Hook(
			dmf(TestingLR2HookScore, {
				scoreData: {
					notesPlayed: TestingLR2HookScore.scoreData.notesTotal - 1,
					extendedJudgements: {
						notesPlayed: TestingLR2HookScore.scoreData.notesTotal - 1,
					},
				},
			} as typeof TestingLR2HookScore),
			{ timeReceived: 10 },
			"ir/lr2hook",
			log,
		);

		expect((res.dryScore.scoreData.optional as { bp: number }).bp).toBe(57);
	});

	it("throws when no chart matches the MD5", async () => {
		await expect(
			ConverterLR2Hook(
				{ ...TestingLR2HookScore, md5: "nonsense_md5" },
				{ timeReceived: 10 },
				"ir/lr2hook",
				log,
			),
		).rejects.toBeInstanceOf(SongOrChartNotFoundFailure);
	});
});
