import { expect, test } from "vitest";
import { isAprx } from "../test-utils/approx";
import { TestCase } from "../test-utils/test-case";
import { expectThrowsSnapshot } from "../test-utils/throw-snapshot";
import { calculate, getRank } from "./maimai-rate";

test("maimai Rate Tests", () => {
	function MakeTestCase(
		score: number,
		maxScore: number,
		level: number,
		expectedRate: number,
	): TestCase {
		return () =>
			isAprx(
				calculate(score, maxScore, level),
				expectedRate,
				`A score of ${score}/${maxScore} on a chart of level ${level} should be worth ${expectedRate} rate.`,
			);
	}

	const testCases = [
		MakeTestCase(100.89, 101.58, 11.8, 14.36),
		MakeTestCase(100.8, 101.18, 12.0, 14.68),
		MakeTestCase(100.23, 100.72, 11.7, 14.02),
		MakeTestCase(99.36, 100.42, 11.0, 12.27),
		MakeTestCase(98.04, 101.21, 10.2, 10.8),
		MakeTestCase(97.62, 100.56, 10.1, 10.47),
		MakeTestCase(96.79, 101.19, 10.8, 9.76),
		MakeTestCase(95.08, 100.91, 10.5, 9.18),
		MakeTestCase(94.16, 100.83, 12.5, 11.04),
		MakeTestCase(93.05, 100.31, 11.5, 9.88),
		MakeTestCase(92.5, 100.53, 13.6, 11.91),
		MakeTestCase(91.62, 100.5, 11.7, 9.9),

		MakeTestCase(100.68, 100.68, 14, 19),
		MakeTestCase(100, 100.79, 13.9, 17.8),

		MakeTestCase(99, 100.71, 12.9, 14.8),
		MakeTestCase(99, 100.54, 8, 9.5),
		MakeTestCase(99, 100.54, 7, 9),

		MakeTestCase(97, 100.36, 11.5, 11.5),
		MakeTestCase(97, 100.54, 8, 8),
		MakeTestCase(97, 100.54, 7, 7.5),

		MakeTestCase(94, 100.3, 10, 8.5),
		MakeTestCase(90, 100.3, 12.5, 10.5),
		MakeTestCase(80, 100.5, 13, 10),
		MakeTestCase(60, 100.59, 12.7, 5.08),
		MakeTestCase(40, 100.54, 9, 1.8),
		MakeTestCase(20, 100.72, 13.6, 1.36),
		MakeTestCase(13, 100.61, 11.7, 0.35),
		MakeTestCase(9, 100.26, 10.5, 0),

		MakeTestCase(100, 100, 13.9, 18.8),
		MakeTestCase(96.99, 100, 8.9, 7.95),

		MakeTestCase(100.9, 100.9, 15.4, 21.8),
	];

	for (const testCase of testCases) {
		testCase();
	}
});

test("maimai Rate Validation Tests", () => {
	expectThrowsSnapshot(
		() => calculate(100, 104.1, 10),
		"Should throw if max score is greater than 104%.",
	);
	expectThrowsSnapshot(
		() => calculate(101.5, 100.68, 10),
		"Should throw if score is greater than max score.",
	);
	expectThrowsSnapshot(() => calculate(-1, 100.68, 10), "Should throw if score is negative.");
	expectThrowsSnapshot(() => calculate(99.5, 100.68, -1), "Should throw if level is negative.");
});

test("getRank falls back to F when no higher rank matches", () => {
	expect(getRank(500)).toBe("F");
});
