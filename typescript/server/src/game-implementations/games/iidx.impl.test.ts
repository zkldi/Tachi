import { IIDX_DP_IMPL, IIDX_SP_IMPL } from "#game-implementations/games/iidx";
import { dmf, mkFakePBIIDXSP } from "#test-utils/misc";
import { Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import {
	type ChartDocumentData,
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	IIDX_GRADES,
	IIDX_LAMPS,
	type integer,
	type MongoProvidedMetrics,
	type ScoreData,
} from "tachi-common";
import { describe, expect, it } from "vitest";

const baseMetrics: MongoProvidedMetrics["iidx-dp" | "iidx-sp"] = {
	lamp: "HARD CLEAR",
	score: 1000,
};

const max = Testing511SPA.data.notecount * 2;

function percentToScore(percent: number) {
	return (percent / 100) * max;
}

function scoreToPercent(score: number) {
	return (100 * score) / max;
}

describe("IIDX_IMPL (unit)", () => {
	describe("scoreDeriver", () => {
		describe.each([IIDX_SP_IMPL, IIDX_DP_IMPL] as const)("SP/DP impl", (impl) => {
			it("computes percent from EX score", () => {
				const f = (
					modifant: Partial<typeof baseMetrics>,
					expected: number,
					_msg?: string,
				) => {
					expect(
						impl.scoreDeriver(
							dmf(baseMetrics, modifant) as never,
							Testing511SPA as never,
						).percent,
					).toBe(expected);
				};

				f(
					{ score: 1000 },
					63.61323155216285,
					"An EXScore of 1000 should result in a percent of 1000 / (notecount*2)",
				);
				f({ score: 0 }, 0, "An EXScore of 0 should count as 0%.");
				f(
					{ score: Testing511SPA.data.notecount * 2 },
					100,
					"A perfect score should be worth 100%",
				);
			});

			it("maps percent to letter grade", () => {
				const f = (percent: number, expected: string) => {
					expect(
						impl.scoreDeriver(
							dmf(baseMetrics, { score: percentToScore(percent) }) as never,
							Testing511SPA as never,
						).grade,
					).toBe(expected);
				};

				f(0, "F");
				f(22.23, "E");
				f(33.34, "D");
				f(44.45, "C");
				f(55.56, "B");
				f(66.67, "A");
				f(77.78, "AA");
				f(88.89, "AAA");
				f(94.45, "MAX-");
				f(100, "MAX");

				f(0, "F");
				f(11.11, "F");
				f(22.22, "F");
				f(33.33, "E");
				f(44.44, "D");
				f(55.55, "C");
				f(66.66, "B");
				f(77.77, "A");
				f(88.88, "AA");
				f(94.44, "AAA");
				f(99.99, "MAX-");
			});
		});
	});

	describe("chartSpecificValidators.score", () => {
		it.each([
			["SP", IIDX_SP_IMPL],
			["DP", IIDX_DP_IMPL],
		] as const)("accepts valid EX scores (%s)", (_playtype, impl) => {
			expect(impl.chartSpecificValidators.score(1000, Testing511SPA as never)).toBe(true);
			expect(impl.chartSpecificValidators.score(0, Testing511SPA as never)).toBe(true);
			expect(
				impl.chartSpecificValidators.score(
					Testing511SPA.data.notecount * 2,
					Testing511SPA as never,
				),
			).toBe(true);
		});

		it.each([
			["SP", IIDX_SP_IMPL],
			["DP", IIDX_DP_IMPL],
		] as const)("rejects invalid EX scores (%s)", (_playtype, impl) => {
			expect(impl.chartSpecificValidators.score(-1, Testing511SPA as never)).toBe(
				"EX Score cannot be negative.",
			);
			expect(
				impl.chartSpecificValidators.score(
					Testing511SPA.data.notecount * 2 + 1,
					Testing511SPA as never,
				),
			).toBe(
				`EX Score cannot be greater than ${Testing511SPA.data.notecount * 2} for this chart.`,
			);
		});
	});

	describe("scoreCalcs BPI", () => {
		it.each([IIDX_SP_IMPL, IIDX_DP_IMPL] as const)("BPI cases", (impl) => {
			const f = (
				scoreData: Partial<ScoreData<"iidx-dp" | "iidx-sp">>,
				chartData: Partial<ChartDocumentData["iidx-dp" | "iidx-sp"]>,
				expected: number,
				_msg?: string,
			) => {
				const sd = dmf(TestingIIDXSPScore.scoreData, scoreData);
				const ch = dmf(Testing511SPA, { data: chartData as never });

				expect(
					impl.scoreCalcs(sd, impl.scoreDeriver(sd, ch as never), ch as never).BPI,
				).toBe(expected);
			};

			f(
				{ score: 123 },
				{ kaidenAverage: 123, worldRecord: 200 },
				0,
				"score == kaidenAverage",
			);
			f({ score: 200 }, { kaidenAverage: 123, worldRecord: 200 }, 100, "score == WR");
			f(
				{ score: 180 },
				{ kaidenAverage: 123, worldRecord: 200 },
				69.64067840359507,
				"general calc",
			);
			f({ score: 100 }, { kaidenAverage: 123, worldRecord: 200 }, -15, "below kavg");
		});
	});

	describe("scoreCalcs ktLampRating", () => {
		it("IIDX SP", () => {
			const f = (
				scoreData: Partial<ScoreData<"iidx-sp">>,
				chartData: Partial<ChartDocumentData["iidx-sp"]>,
				expected: number,
				_msg?: string,
			) => {
				const sd = dmf(TestingIIDXSPScore.scoreData, scoreData);
				const ch = dmf(Testing511SPA, { data: chartData as never });

				expect(
					IIDX_SP_IMPL.scoreCalcs(sd, IIDX_SP_IMPL.scoreDeriver(sd, ch), ch).ktLampRating,
				).toBe(expected);
			};

			f({ lamp: "FAILED" }, {}, 0);
			f({ lamp: "ASSIST CLEAR" }, {}, 0);
			f({ lamp: "EASY CLEAR" }, {}, 0);
			f({ lamp: "CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "HARD CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "EX HARD CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "FULL COMBO" }, {}, Testing511SPA.levelNum);

			function mkTier(v: number) {
				return { value: v, text: "whatever", individualDifference: false };
			}

			f({ lamp: "CLEAR" }, { ncTier: mkTier(15) }, 15);
			f({ lamp: "HARD CLEAR" }, { ncTier: mkTier(15), hcTier: mkTier(16) }, 16);
			f(
				{ lamp: "EX HARD CLEAR" },
				{ ncTier: mkTier(15), hcTier: mkTier(16), exhcTier: mkTier(17) },
				17,
			);
			f({ lamp: "HARD CLEAR" }, { ncTier: mkTier(15) }, 15);
			f({ lamp: "EX HARD CLEAR" }, { ncTier: mkTier(15) }, 15);
			f({ lamp: "EX HARD CLEAR" }, { ncTier: mkTier(15), hcTier: mkTier(16) }, 16);
		});

		it("IIDX DP", () => {
			const f = (
				scoreData: Partial<ScoreData<"iidx-dp">>,
				chartData: Partial<ChartDocumentData["iidx-dp"]>,
				expected: number,
				_msg?: string,
			) => {
				const sd = dmf(TestingIIDXSPScore.scoreData, scoreData);
				const ch = dmf(Testing511SPA, { data: chartData as never });

				expect(
					IIDX_DP_IMPL.scoreCalcs(
						sd,
						IIDX_DP_IMPL.scoreDeriver(sd, ch as never),
						ch as never,
					).ktLampRating,
				).toBe(expected);
			};

			f({ lamp: "FAILED" }, {}, 0);
			f({ lamp: "ASSIST CLEAR" }, {}, 0);
			f({ lamp: "EASY CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "HARD CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "EX HARD CLEAR" }, {}, Testing511SPA.levelNum);
			f({ lamp: "FULL COMBO" }, {}, Testing511SPA.levelNum);

			function mkTier(v: number) {
				return { value: v, text: "whatever", individualDifference: false };
			}

			f({ lamp: "EASY CLEAR" }, { dpTier: mkTier(15) }, 15);
			f({ lamp: "CLEAR" }, { dpTier: mkTier(15) }, 15);
			f({ lamp: "HARD CLEAR" }, { dpTier: mkTier(15) }, 15);
			f({ lamp: "EX HARD CLEAR" }, { dpTier: mkTier(15) }, 15);
		});
	});

	describe("scoreCalcs ktLampRatingHC / ktLampRatingEXHC", () => {
		it("IIDX SP", () => {
			const run = (
				scoreData: Partial<ScoreData<"iidx-sp">>,
				chartData: Partial<ChartDocumentData["iidx-sp"]>,
			) =>
				IIDX_SP_IMPL.scoreCalcs(
					dmf(TestingIIDXSPScore.scoreData, scoreData),
					IIDX_SP_IMPL.scoreDeriver(
						dmf(TestingIIDXSPScore.scoreData, scoreData),
						dmf(Testing511SPA, { data: chartData as never }),
					),
					dmf(Testing511SPA, { data: chartData as never }),
				);

			function mkTier(v: number) {
				return { value: v, text: "whatever", individualDifference: false };
			}

			const tiered = { ncTier: mkTier(15), hcTier: mkTier(16), exhcTier: mkTier(17) };

			expect(run({ lamp: "FAILED" }, {})).toMatchObject({
				ktLampRatingHC: 0,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "EASY CLEAR" }, {})).toMatchObject({
				ktLampRatingHC: 0,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "CLEAR" }, tiered)).toMatchObject({
				ktLampRatingHC: 0,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "HARD CLEAR" }, tiered)).toMatchObject({
				ktLampRatingHC: 16,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "EX HARD CLEAR" }, tiered)).toMatchObject({
				ktLampRatingHC: 16,
				ktLampRatingEXHC: 17,
			});
			expect(run({ lamp: "FULL COMBO" }, tiered)).toMatchObject({
				ktLampRatingHC: 16,
				ktLampRatingEXHC: 17,
			});
			expect(run({ lamp: "HARD CLEAR" }, { ncTier: mkTier(15) })).toMatchObject({
				ktLampRatingHC: 15,
				ktLampRatingEXHC: 0,
			});
		});

		it("IIDX DP", () => {
			const run = (
				scoreData: Partial<ScoreData<"iidx-dp">>,
				chartData: Partial<ChartDocumentData["iidx-dp"]>,
			) =>
				IIDX_DP_IMPL.scoreCalcs(
					dmf(TestingIIDXSPScore.scoreData, scoreData),
					IIDX_DP_IMPL.scoreDeriver(
						dmf(TestingIIDXSPScore.scoreData, scoreData),
						dmf(Testing511SPA, { data: chartData as never }) as never,
					),
					dmf(Testing511SPA, { data: chartData as never }) as never,
				);

			function mkTier(v: number) {
				return { value: v, text: "whatever", individualDifference: false };
			}

			expect(run({ lamp: "EASY CLEAR" }, { dpTier: mkTier(15) })).toMatchObject({
				ktLampRatingHC: 0,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "CLEAR" }, { dpTier: mkTier(15) })).toMatchObject({
				ktLampRatingHC: 0,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "HARD CLEAR" }, { dpTier: mkTier(15) })).toMatchObject({
				ktLampRatingHC: 15,
				ktLampRatingEXHC: 0,
			});
			expect(run({ lamp: "EX HARD CLEAR" }, { dpTier: mkTier(15) })).toMatchObject({
				ktLampRatingHC: 15,
				ktLampRatingEXHC: 15,
			});
			expect(run({ lamp: "FULL COMBO" }, { dpTier: mkTier(15) })).toMatchObject({
				ktLampRatingHC: 15,
				ktLampRatingEXHC: 15,
			});
		});
	});

	describe("goal formatters", () => {
		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "percent", value: 94.42123, mode: "single" }, "iidx-sp"),
			).toBe("Get 94.42% on");
			expect(
				FormatGoalCriteria({ key: "percent", value: 94.426, mode: "single" }, "iidx-sp"),
			).toBe("Get 94.43% on");
			expect(
				FormatGoalCriteria({ key: "score", value: 1234, mode: "single" }, "iidx-sp"),
			).toBe("Get a score of 1234 on");
			expect(FormatGoalCriteria({ key: "score", value: 0, mode: "single" }, "iidx-sp")).toBe(
				"Get a score of 0 on",
			);
		});
		describe.each([
			[IIDX_SP_IMPL, "iidx-sp"],
			[IIDX_DP_IMPL, "iidx-dp"],
		] as const)("impl", (impl, game) => {
			it("progress", () => {
				const fmt = GAME_GOAL_PROGRESS_FORMATTERS[game];
				const f = (
					k: keyof typeof fmt,
					modifant: Partial<ScoreData<"iidx-dp" | "iidx-sp">>,
					goalValue: integer,
					expected: string,
				) => {
					expect(
						fmt[k](
							mkFakePBIIDXSP({ scoreData: modifant } as never) as never,
							goalValue,
						),
					).toBe(expected);
				};

				f("score", { score: 1234 }, 1000, "1234");
				f("score", { score: 0 }, 1000, "0");

				f("percent", { percent: 92.17472 }, 100, "92.17%");
				f("percent", { percent: 92.17572 }, 100, "92.18%");

				f(
					"grade",
					{ score: 1333, percent: scoreToPercent(1333), grade: "AA" },
					IIDX_GRADES.AAA,
					"AAA-64",
				);
				f(
					"grade",
					{ score: 1233, percent: scoreToPercent(1233), grade: "AA" },
					IIDX_GRADES.AAA,
					"AAA-164",
				);
				f(
					"grade",
					{ score: 1400, percent: scoreToPercent(1400), grade: "AAA" },
					IIDX_GRADES.AAA,
					"AAA+3",
				);

				f(
					"lamp",
					{ lamp: "HARD CLEAR", optional: { bp: 2 } as never },
					IIDX_LAMPS.HARD_CLEAR,
					"HARD CLEAR (BP: 2)",
				);

				f(
					"lamp",
					{ lamp: "HARD CLEAR", optional: { bp: null } as never },
					IIDX_LAMPS.HARD_CLEAR,
					"HARD CLEAR",
				);
				f(
					"grade",
					{ score: 1899, percent: (100 * 1899) / 1918, grade: "MAX-" },
					IIDX_GRADES.MAX,
					"MAX-19",
				);

				f(
					"grade",
					{ score: 2831, percent: (100 * 2831) / 3546, grade: "AA" },
					IIDX_GRADES.AA,
					"AA+73",
				);
			});

			it("outOf", () => {
				const gConf = GetGameConfig(game);
				const toFmt = (m: string) =>
					(GetScoreMetricConf(gConf, m) as { goalOutOfFormatter: (v: number) => string })
						.goalOutOfFormatter;
				expect(toFmt("percent")(94.42123)).toBe("94.42%");
				expect(toFmt("score")(1234)).toBe("1234");
			});
		});
	});
});
