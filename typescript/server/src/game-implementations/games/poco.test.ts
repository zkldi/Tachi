import { POLARISCHORD_IMPL } from "#game-implementations/games/poco";
import type { ChartDocument } from "tachi-common";
import { describe, expect, it } from "vitest";

const mockChart = {
	levelNum: 10,
} as ChartDocument<"poco">;

describe("POLARISCHORD_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		it("calculates grade correctly based on percent", () => {
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 100 } as any, mockChart).grade).toBe(
				"SSS+",
			);
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 99.5 } as any, mockChart).grade).toBe(
				"SSS+",
			);
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 99.0 } as any, mockChart).grade).toBe(
				"SSS",
			);
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 95.0 } as any, mockChart).grade).toBe(
				"AAA",
			);
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 80.0 } as any, mockChart).grade).toBe(
				"B",
			);
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 70.0 } as any, mockChart).grade).toBe(
				"C",
			);
			expect(POLARISCHORD_IMPL.scoreDeriver({ percent: 69.9 } as any, mockChart).grade).toBe(
				"D",
			);
		});
	});

	describe("scoreCalcs (paSkill)", () => {
		it("calculates paSkill correctly", () => {
			// At 100%, modifier is 2.3
			expect(
				POLARISCHORD_IMPL.scoreCalcs({ percent: 100 } as any, {} as any, mockChart).paSkill,
			).toBeCloseTo(12.3);
			// At 98.0%, modifier is 0.5
			expect(
				POLARISCHORD_IMPL.scoreCalcs({ percent: 98.0 } as any, {} as any, mockChart)
					.paSkill,
			).toBeCloseTo(10.5);
			// At 95.0%, modifier is 0.0
			expect(
				POLARISCHORD_IMPL.scoreCalcs({ percent: 95.0 } as any, {} as any, mockChart)
					.paSkill,
			).toBeCloseTo(10.0);
			// At 85.0%, modifier is -1.0
			expect(
				POLARISCHORD_IMPL.scoreCalcs({ percent: 85.0 } as any, {} as any, mockChart)
					.paSkill,
			).toBeCloseTo(9.0);
		});
	});

	describe("classDerivers", () => {
		it("returns correct colour based on PA SKILL", () => {
			expect(POLARISCHORD_IMPL.classDerivers({ paSkill: 16.5 } as any).colour).toBe(
				"RAINBOW",
			);
			expect(POLARISCHORD_IMPL.classDerivers({ paSkill: 15.0 } as any).colour).toBe("PURPLE");
			expect(POLARISCHORD_IMPL.classDerivers({ paSkill: 12.0 } as any).colour).toBe("ORANGE");
			expect(POLARISCHORD_IMPL.classDerivers({ paSkill: 6.0 } as any).colour).toBe("BLUE");
			expect(POLARISCHORD_IMPL.classDerivers({ paSkill: 0.5 } as any).colour).toBe("GRAY");
			expect(POLARISCHORD_IMPL.classDerivers({ paSkill: null } as any).colour).toBeNull();
		});
	});

	//This test serves as a validator for score lamps and other metrics to match the corresponding ACHIEVEMENT RATE
	describe("scoreValidators", () => {
		const [apValidator, fcValidator, apJudgementsValidator] =
			POLARISCHORD_IMPL.scoreValidators!;

		it("validates ALL PERFECT percent", () => {
			expect(
				apValidator(
					{ scoreData: { lamp: "ALL PERFECT", percent: 99.9 } } as any,
					null as any,
				),
			).toMatch(/ALL PERFECT scores must have a 100% percent/);
			expect(
				apValidator(
					{ scoreData: { lamp: "ALL PERFECT", percent: 100 } } as any,
					null as any,
				),
			).toBeUndefined();
		});

		it("validates FULL COMBO misses", () => {
			expect(
				fcValidator(
					{ scoreData: { lamp: "FULL COMBO", judgements: { miss: 1 } } } as any,
					null as any,
				),
			).toMatch(/Cannot have a FULL COMBO with misses/);
			expect(
				fcValidator(
					{ scoreData: { lamp: "FULL COMBO", judgements: { miss: 0 } } } as any,
					null as any,
				),
			).toBeUndefined();
		});

		it("validates ALL PERFECT judgements", () => {
			expect(
				apJudgementsValidator(
					{ scoreData: { lamp: "ALL PERFECT", judgements: { good: 1 } } } as any,
					null as any,
				),
			).toMatch(/Cannot have an ALL PERFECT/);
			expect(
				apJudgementsValidator(
					{
						scoreData: {
							lamp: "ALL PERFECT",
							judgements: { miss: 0, bad: 0, good: 0, great: 0 },
						},
					} as any,
					null as any,
				),
			).toBeUndefined();
		});
	});
});
