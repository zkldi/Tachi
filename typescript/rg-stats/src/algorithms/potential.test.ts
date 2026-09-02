import { expect, test } from "vitest";
import { isAprx } from "../test-utils/approx";
import { TestCase } from "../test-utils/test-case";
import { ArcaeaLamp, calculate } from "./potential";

test("Arcaea Potential Tests", () => {
	function MakeTestCase(score: number, level: number, expectedPotential: number): TestCase {
		return () => {
			const clearLamps: ArcaeaLamp[] = ["EASY CLEAR", "CLEAR", "HARD CLEAR", "FULL RECALL"];
			isAprx(
				calculate(score, level, "LOST"),
				expectedPotential,
				`A LOST score of ${score} on a chart of level ${level} should be worth roughly ${expectedPotential}`,
				2,
			);
			clearLamps.forEach((lamp) => {
				isAprx(
					calculate(score, level, lamp),
					expectedPotential + 0.2,
					`A ${lamp} score of ${score} on a chart of level ${level} should be worth roughly ${expectedPotential + 0.2}`,
					2,
				);
			});
		};
	}

	const testCases = [
		MakeTestCase(9_977_755, 11.3, 13.19),
		MakeTestCase(9_934_498, 11.1, 12.77),
		MakeTestCase(9_932_746, 10.9, 12.56),
		MakeTestCase(9_805_015, 11.6, 12.63),

		MakeTestCase(9_900_000, 8.0, 9.5),
		MakeTestCase(9_800_000, 9.5, 10.5),
		MakeTestCase(9_500_000, 8.9, 8.9),
		MakeTestCase(9_200_000, 7.5, 6.5),
		MakeTestCase(8_900_000, 9.5, 7.5),
		MakeTestCase(8_600_000, 10.5, 7.5),
	];

	for (const testCase of testCases) {
		testCase();
	}

	isAprx(
		calculate(10_000_000, 7.0, "PURE MEMORY"),
		9.2,
		`A PURE MEMORY on a chart of level 7.0 should be worth 9.2`,
		3,
	);

	expect(() => calculate(9_999_999, 7.0, "PURE MEMORY")).toThrow(
		/.*PURE MEMORY cannot be below 10 million.*/u,
	);
	expect(() => calculate(10_000_000, 7.0, "CLEAR")).toThrow(
		/.*Scores exceeding 10 million must be PURE MEMORY.*/u,
	);

	expect(
		calculate(10_000_000, 10.0, "PURE MEMORY"),
		"Anything above 10,000,000 should give identical potential.",
	).toBe(calculate(10_001_000, 10.0, "PURE MEMORY"));
});
