import { expect, test } from "vitest";
import { isAprx } from "../test-utils/approx";
import { TestCase } from "../test-utils/test-case";
import { calculate } from "./potential";

test("Arcaea Potential Tests", () => {
	function MakeTestCase(score: number, level: number, expectedPotential: number): TestCase {
		return () =>
			isAprx(
				calculate(score, level),
				expectedPotential,
				`A score of ${score} on a chart of level ${level} should be worth ${expectedPotential}`,
			);
	}

	const testCases = [
		MakeTestCase(9_977_755, 11.3, 13.19),
		MakeTestCase(9_934_498, 11.1, 12.77),
		MakeTestCase(9_932_746, 10.9, 12.56),
		MakeTestCase(9_805_015, 11.6, 12.63),

		MakeTestCase(10_000_000, 7.0, 9.0),
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

	expect(
		calculate(10_000_000, 10.0),
		"Anything above 10,000,000 should give identical potential.",
	).toBe(calculate(10_001_000, 10.0));
});
