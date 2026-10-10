import { describe, expect, it } from "vitest";
import { calculate } from "./poco-paskill";

describe("poco-paskill calculate", () => {
	it("returns correct skill for percent >= 100", () => {
		expect(calculate(100.0, 10)).toBe(12.3);
		expect(calculate(101.5, 12)).toBe(14.3);
	});

	it("returns correct skill for percent >= 99.5", () => {
		expect(calculate(99.5, 10)).toBe(12.0);
		expect(calculate(99.7, 10)).toBeCloseTo(12.12);
	});

	it("returns correct skill for percent >= 98.0", () => {
		expect(calculate(98.0, 10)).toBe(10.5);
		expect(calculate(99.0, 10)).toBe(11.5);
	});

	it("returns correct skill for percent >= 95.0", () => {
		expect(calculate(95.0, 10)).toBe(10.0);
		expect(calculate(96.5, 10)).toBeCloseTo(10.25);
	});

	it("returns correct skill for percent >= 85.0", () => {
		expect(calculate(85.0, 10)).toBe(9.0);
		expect(calculate(90.0, 10)).toBe(9.5);
	});

	it("returns correct skill for percent >= 80.0", () => {
		// at80 for level 10: -(13) / 4.0 = -3.25. slope = (-1 - (-3.25))/5 = 0.45.
		// percent = 80.0 => modifier = -3.25. skill = 6.75
		expect(calculate(80.0, 10)).toBe(6.75);
		// percent = 82.5 => modifier = -3.25 + 2.5 * 0.45 = -2.125. skill = 7.875
		expect(calculate(82.5, 10)).toBe(7.875);
	});

	it("returns correct skill for percent >= 50.0", () => {
		// at50 for level 10: -10. at80 = -3.25. slope = (-3.25 - (-10))/30 = 6.75/30 = 0.225.
		// percent = 50.0 => modifier = -10. skill = 0
		expect(calculate(50.0, 10)).toBe(0);
		// percent = 65.0 => modifier = -10 + 15 * 0.225 = -6.625. skill = 3.375
		expect(calculate(65.0, 10)).toBe(3.375);
	});

	it("returns correct skill for percent < 50.0", () => {
		// modifier = -levelNum. skill = 0
		expect(calculate(49.9, 10)).toBe(0);
		expect(calculate(0.0, 10)).toBe(0);
	});
});
