import type { USCClientScore } from "#server/router/ir/usc/_playtype/types";

import { log } from "#lib/log/log";
import { InvalidScoreFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import { TestingUSCChart, TestingUSCSong, uscScore } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import { ConverterIRUSC, DeriveLamp, DeriveNoteMod } from "./converter";

const USC_CTRL_CHART_ID = "usc_ir_test_chart_controller";

async function seedUscControllerChart() {
	await DB.insertInto("song")
		.values({
			id: TestingUSCSong.id,
			legacy_id: 1,
			game_group: "usc",
			title: TestingUSCSong.title,
			artist: TestingUSCSong.artist,
			search_terms: TestingUSCSong.searchTerms,
			alt_titles: TestingUSCSong.altTitles,
			data: TestingUSCSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: USC_CTRL_CHART_ID,
			legacy_id: USC_CTRL_CHART_ID,
			game: "usc-controller",
			song_id: TestingUSCSong.id,
			difficulty: TestingUSCChart.difficulty,
			level: TestingUSCChart.level,
			level_num: TestingUSCChart.levelNum,
			is_primary: TestingUSCChart.isPrimary,
			versions: TestingUSCChart.versions,
			data: TestingUSCChart.data,
		})
		.execute();
}

const d = <T extends object>(base: T, patch: Partial<T>): T => deepmerge(base, patch);

describe("DeriveLamp", () => {
	it("maps USC gauge and score rules", () => {
		expect(DeriveLamp(uscScore)).toBe("EXCESSIVE CLEAR");

		expect(
			DeriveLamp(d(uscScore, { options: { ...uscScore.options, gaugeType: 0 }, gauge: 0.5 })),
		).toBe("FAILED");
		expect(
			DeriveLamp(d(uscScore, { options: { ...uscScore.options, gaugeType: 0 }, gauge: 0.7 })),
		).toBe("CLEAR");

		expect(
			DeriveLamp(d(uscScore, { options: { ...uscScore.options, gaugeType: 2 }, gauge: 1 })),
		).toBe("FAILED");
		expect(
			DeriveLamp(d(uscScore, { options: { ...uscScore.options, gaugeType: 2 }, gauge: 0 })),
		).toBe("FAILED");
		expect(
			DeriveLamp(
				d(uscScore, {
					options: { ...uscScore.options, gaugeType: 2 },
					gauge: 1,
					score: 10_000_000,
				}),
			),
		).toBe("PERFECT ULTIMATE CHAIN");
		expect(
			DeriveLamp(
				d(uscScore, { options: { ...uscScore.options, gaugeType: 2 }, gauge: 1, error: 0 }),
			),
		).toBe("ULTIMATE CHAIN");

		expect(
			DeriveLamp(d(uscScore, { options: { ...uscScore.options, gaugeType: 1 }, gauge: 0.1 })),
		).toBe("EXCESSIVE CLEAR");
		expect(
			DeriveLamp(d(uscScore, { options: { ...uscScore.options, gaugeType: 1 }, gauge: 0 })),
		).toBe("FAILED");

		expect(
			DeriveLamp(
				d(uscScore, {
					score: 10_000_000,
					options: { ...uscScore.options, gaugeType: 1 },
					gauge: 0.1,
				}),
			),
		).toBe("PERFECT ULTIMATE CHAIN");

		expect(
			DeriveLamp(
				d(uscScore, {
					score: 10_000_000,
					options: { ...uscScore.options, gaugeType: 1 },
					gauge: 0.1,
					error: 0,
				}),
			),
		).toBe("PERFECT ULTIMATE CHAIN");

		expect(
			DeriveLamp(
				d(uscScore, {
					score: 9_000_000,
					options: { ...uscScore.options, gaugeType: 0 },
					gauge: 0.15,
					error: 0,
				}),
			),
		).toBe("ULTIMATE CHAIN");

		expect(() =>
			DeriveLamp(
				d(uscScore, {
					options: { ...uscScore.options, gaugeType: 3 as never },
				}) as unknown as USCClientScore,
			),
		).toThrow(/Invalid gaugeType/u);
	});
});

describe("DeriveNoteMod", () => {
	it("maps mirror / random flags", () => {
		expect(DeriveNoteMod(uscScore)).toBe("MIRROR");
		expect(DeriveNoteMod(d(uscScore, { options: { ...uscScore.options, random: true } }))).toBe(
			"MIR-RAN",
		);
		expect(
			DeriveNoteMod(
				d(uscScore, { options: { ...uscScore.options, random: false, mirror: false } }),
			),
		).toBe("NORMAL");
		expect(
			DeriveNoteMod(
				d(uscScore, { options: { ...uscScore.options, random: true, mirror: false } }),
			),
		).toBe("RANDOM");
	});
});

describe("ConverterIRUSC", () => {
	beforeEach(seedUscControllerChart);

	const dm = (p: Partial<USCClientScore>) =>
		ConverterIRUSC(
			d(uscScore, p),
			{
				chartHash: TestingUSCChart.data.hashSHA1 as string,
				playtype: "Controller",
				timeReceived: 10,
			},
			"ir/usc",
			log,
		);

	it("converts a score", async () => {
		const res = await dm({});

		expect(res.song.id).toBe(TestingUSCSong.id);
		expect(res.chart.chartID).toBe(USC_CTRL_CHART_ID);
		expect(res.dryScore.game).toBe("usc-controller");
		expect(res.dryScore.importType).toBe("ir/usc");
		expect((res.dryScore.scoreData as { score: number }).score).toBe(uscScore.score);
	});

	it("rejects modified hit windows", async () => {
		await expect(dm({ windows: { perfect: 0 } } as USCClientScore)).rejects.toThrow(
			InvalidScoreFailure,
		);
		await expect(dm({ windows: { good: 0 } } as USCClientScore)).rejects.toThrow(
			InvalidScoreFailure,
		);
		await expect(dm({ windows: { hold: 0 } } as USCClientScore)).rejects.toThrow(
			InvalidScoreFailure,
		);
		await expect(dm({ windows: { miss: 0 } } as USCClientScore)).rejects.toThrow(
			InvalidScoreFailure,
		);
		await expect(dm({ windows: { slam: 0 } } as USCClientScore)).rejects.toThrow(
			InvalidScoreFailure,
		);
	});

	it("rejects non-zero autoFlags", async () => {
		await expect(dm({ options: { autoFlags: 1 } } as USCClientScore)).rejects.toThrow(
			InvalidScoreFailure,
		);
	});
});
