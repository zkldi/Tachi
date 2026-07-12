import { DDR_IMPL } from "#game-implementations/games/ddr";
import { dmf, mkFakePBDDRSP } from "#test-utils/misc";
import { TestingDDRSP, TestingDDRSPScore } from "#test-utils/test-data";
import {
	type ChartDocumentData,
	DDR_GRADES,
	DDR_LAMPS,
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	type integer,
	type MongoProvidedMetrics,
	type ScoreData,
} from "tachi-common";
import { describe, expect, it } from "vitest";

const baseMetrics: MongoProvidedMetrics["ddr-dp" | "ddr-sp"] = {
	lamp: "CLEAR",
	score: 750_000,
};

describe("DDR_IMPL", () => {
	describe("scoreDeriver grade", () => {
		const impl = DDR_IMPL;
		const f = (score: number, expected: string) => {
			expect(
				impl.scoreDeriver(dmf(baseMetrics, { score }) as never, TestingDDRSP as never)
					.grade,
			).toBe(expected);
		};

		it("maps EX score to DDR letter grades", () => {
			f(990500, "AAA");
			f(950500, "AA+");
			f(900500, "AA");
			f(890500, "AA-");
			f(850500, "A+");
			f(800500, "A");
			f(790500, "A-");
			f(750500, "B+");
			f(700500, "B");
			f(690500, "B-");
			f(650500, "C+");
			f(600500, "C");
			f(590500, "C-");
			f(550500, "D+");
			f(500, "D");
		});
	});

	describe("classDerivers flare", () => {
		const impl = DDR_IMPL;
		const f = (ratings: number, expected: string) => {
			expect(impl.classDerivers({ flareSkill: ratings }).flare).toBe(expected);
		};

		it("maps flare skill to flare rank", () => {
			f(1, "NONE");
			f(501, "NONE+");
			f(1001, "NONE++");
			f(1501, "NONE+++");
			f(2001, "MERCURY");
			f(3001, "MERCURY+");
			f(4001, "MERCURY++");
			f(5001, "MERCURY+++");
			f(6001, "VENUS");
			f(7001, "VENUS+");
			f(8001, "VENUS++");
			f(9001, "VENUS+++");
			f(10001, "EARTH");
			f(11501, "EARTH+");
			f(13001, "EARTH++");
			f(14501, "EARTH+++");
			f(16001, "MARS");
			f(18001, "MARS+");
			f(20001, "MARS++");
			f(22001, "MARS+++");
			f(24001, "JUPITER");
			f(26501, "JUPITER+");
			f(29001, "JUPITER++");
			f(31501, "JUPITER+++");
			f(34001, "SATURN");
			f(36751, "SATURN+");
			f(39501, "SATURN++");
			f(42251, "SATURN+++");
			f(45001, "URANUS");
			f(48751, "URANUS+");
			f(52501, "URANUS++");
			f(56251, "URANUS+++");
			f(60001, "NEPTUNE");
			f(63751, "NEPTUNE+");
			f(67501, "NEPTUNE++");
			f(71251, "NEPTUNE+++");
			f(75001, "SUN");
			f(78751, "SUN+");
			f(82501, "SUN++");
			f(86251, "SUN+++");
			f(90001, "WORLD");
		});
	});

	describe("scoreCalcs flareSkill", () => {
		const impl = DDR_IMPL;
		const f = (
			scoreData: Partial<ScoreData<"ddr-dp" | "ddr-sp">>,
			chartData: Partial<ChartDocumentData["ddr-dp" | "ddr-sp"]>,
			expected: number,
			_msg?: string,
		) => {
			const sd = dmf(TestingDDRSPScore.scoreData, scoreData);
			const ch = dmf(TestingDDRSP, { data: chartData as never }) as never;

			expect(impl.scoreCalcs(sd, impl.scoreDeriver(sd, ch), ch).flareSkill).toBe(expected);
		};

		it("computes flare skill from grade, lamp, and flare", () => {
			f({ grade: "AA", lamp: "CLEAR", optional: { flare: "II", enumIndexes: {} } }, {}, 257);
			f({ grade: "E", lamp: "FAILED" }, {}, 0);
		});
	});

	describe("goal formatters", () => {
		const impl = DDR_IMPL;

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "score", value: 123456, mode: "single" }, "ddr-sp"),
			).toBe("Get a score of 123,456 on");
			expect(FormatGoalCriteria({ key: "score", value: 0, mode: "single" }, "ddr-sp")).toBe(
				"Get a score of 0 on",
			);
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS["ddr-sp"];
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"ddr-dp" | "ddr-sp">>,
				goalValue: integer,
				expected: string,
			) => {
				expect(
					fmt[k](
						mkFakePBDDRSP({
							scoreData: modifant,
						} as never),
						goalValue,
					),
				).toBe(expected);
			};

			f("score", { score: 123_456 }, 1_000_000, "123,456");
			f("score", { score: 0 }, 1_000_000, "0");

			f("grade", { score: 955000, grade: "AA+" }, DDR_GRADES.AAA, "AAA-35,000");
			f("grade", { score: 995000, grade: "AAA" }, DDR_GRADES.AAA, "AAA+5,000");

			f("lamp", { lamp: "CLEAR", optional: {} as never }, DDR_LAMPS.FULL_COMBO, "CLEAR");

			f(
				"lamp",
				{ lamp: "FULL COMBO", optional: {} as never },
				DDR_LAMPS.FULL_COMBO,
				"FULL COMBO",
			);
		});

		it("outOf", () => {
			const scoreMetric = GetScoreMetricConf(GetGameConfig("ddr-sp"), "score") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(scoreMetric.goalOutOfFormatter(123456)).toBe("123,456");
		});
	});
});
