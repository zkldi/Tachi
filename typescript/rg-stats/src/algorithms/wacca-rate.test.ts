import { expect, test } from "vitest";
import { isAprx } from "../test-utils/approx";
import { TestCase } from "../test-utils/test-case";
import { expectThrowsSnapshot } from "../test-utils/throw-snapshot";
import { integer } from "../util/types";
import { calculate, calculatePlus, inverse, inversePlus } from "./wacca-rate";

test("WACCA Rate Tests", () => {
	function MakeTestCase(score: integer, level: number, expectedRate: number): TestCase {
		return () =>
			isAprx(
				calculate(score, level),
				expectedRate,
				`A score of ${score} on a chart of level ${level} should be worth ${expectedRate} rate.`,
			);
	}

	const testCases = [
		MakeTestCase(990_084, 13.2, 52.8),
		MakeTestCase(984_040, 12.9, 48.375),
		MakeTestCase(950_326, 12.2, 36.6),
		MakeTestCase(997_719, 4, 16),
		MakeTestCase(906_440, 13.8, 27.6),

		MakeTestCase(990_000, 10.2, 40.8),
		MakeTestCase(980_000, 10.7, 40.125),
		MakeTestCase(960_000, 9, 29.25),
		MakeTestCase(950_000, 8, 24),
		MakeTestCase(940_000, 8, 22),
		MakeTestCase(920_000, 8, 20),
		MakeTestCase(900_000, 8, 16),
		MakeTestCase(850_000, 8, 12),
		MakeTestCase(500, 10, 10),
		MakeTestCase(0, 10, 10),
		MakeTestCase(849_999, 10, 10),
	];

	for (const testCase of testCases) {
		testCase();
	}

	expect(calculate(975_000, 10), "970K and 975K should give identical rates.").toBe(
		calculate(970_000, 10),
	);

	expect(calculate(1_000_000, 10), "990K and 1m should give identical rates.").toBe(
		calculate(990_000, 10),
	);
});

test("WACCA Plus Rate Tests", () => {
	function MakeTestCase(score: integer, level: number, expectedRate: number): TestCase {
		return () =>
			isAprx(
				calculatePlus(score, level),
				expectedRate,
				`A score of ${score} on a chart of level ${level} should be worth ${expectedRate} rate.`,
			);
	}

	const testCases = [
		MakeTestCase(997_719, 4, 16.2),
		MakeTestCase(993_779, 13.2, 53.196),
		MakeTestCase(985_040, 12.9, 49.9875),
		MakeTestCase(968_374, 13.6, 45.9),
		MakeTestCase(950_326, 12.2, 36.6),
		MakeTestCase(906_440, 13.8, 27.6),

		MakeTestCase(995_000, 10.2, 41.31),
		MakeTestCase(994_000, 10.2, 41.208),
		MakeTestCase(993_000, 10.2, 41.106),
		MakeTestCase(992_000, 10.2, 41.004),
		MakeTestCase(991_000, 10.2, 40.902),
		MakeTestCase(990_000, 10.2, 40.8),
		MakeTestCase(985_000, 10.7, 41.4625),
		MakeTestCase(980_000, 10.7, 40.125),
		MakeTestCase(960_000, 9, 29.25),
		MakeTestCase(955_000, 8, 25),
		MakeTestCase(950_000, 8, 24),
		MakeTestCase(940_000, 8, 22),
		MakeTestCase(920_000, 8, 20),
		MakeTestCase(900_000, 8, 16),
		MakeTestCase(850_000, 8, 12),
		MakeTestCase(849_999, 10, 10),
		MakeTestCase(500, 10, 10),
		MakeTestCase(0, 10, 10),
	];

	for (const testCase of testCases) {
		testCase();
	}

	expect(calculatePlus(975_000, 10), "970K and 975K should NOT give identical rates.").not.toBe(
		calculatePlus(970_000, 10),
	);

	expect(calculatePlus(1_000_000, 10), "990K and 1m should NOT give identical rates.").not.toBe(
		calculatePlus(990_000, 10),
	);
});

test("WACCA Rate Validation Tests", () => {
	expectThrowsSnapshot(() => calculate(-1, 10), "Should throw if score is negative.");
	expectThrowsSnapshot(
		() => calculate(1_000_001, 10),
		"Should throw if score is greater than 1million.",
	);
	expectThrowsSnapshot(() => calculate(900_000, -1), "Should throw if level is negative.");
	expectThrowsSnapshot(() => calculatePlus(-1, 10), "Should throw if score is negative.");
	expectThrowsSnapshot(
		() => calculatePlus(1_000_001, 10),
		"Should throw if score is greater than 1million.",
	);
	expectThrowsSnapshot(() => calculatePlus(900_000, -1), "Should throw if level is negative.");
});

test("WACCA Inverse Rate Tests", () => {
	function MakeTestCase(expectedScore: integer, level: number, rate: number): TestCase {
		return () =>
			isAprx(
				inverse(rate, level),
				expectedScore,
				`A rate of ${rate} on a chart of level ${level} should invert to ${expectedScore} rate.`,
			);
	}

	const testCases = [
		MakeTestCase(990_000, 13.2, 52.8),
		MakeTestCase(980_000, 12.9, 48.375),
		MakeTestCase(950_000, 12.2, 36.6),
		MakeTestCase(970_000, 12.2, 40),
		MakeTestCase(990_000, 4, 16),
		MakeTestCase(900_000, 13.8, 27.6),
		MakeTestCase(990_000, 10.2, 40.8),
		MakeTestCase(980_000, 10.7, 40.125),
		MakeTestCase(960_000, 9, 29.25),
		MakeTestCase(950_000, 8, 24),
		MakeTestCase(940_000, 8, 22),
		MakeTestCase(920_000, 8, 20),
		MakeTestCase(900_000, 8, 16),
		MakeTestCase(850_000, 8, 12),
		MakeTestCase(0, 10, 10),
	];

	for (const testCase of testCases) {
		testCase();
	}
});

test("WACCA Plus Inverse Rate Tests", () => {
	function MakeTestCase(expectedScore: integer, level: number, rate: number): TestCase {
		return () =>
			isAprx(
				inversePlus(rate, level),
				expectedScore,
				`A rate of ${rate} on a chart of level ${level} should invert to ${expectedScore} rate.`,
			);
	}

	const testCases = [
		MakeTestCase(995_000, 4, 16.2),
		MakeTestCase(994_000, 4, 16.16),
		MakeTestCase(993_000, 4, 16.12),
		MakeTestCase(993_000, 13.2, 53.196),
		MakeTestCase(992_000, 4, 16.08),
		MakeTestCase(991_000, 4, 16.04),
		MakeTestCase(990_000, 4, 16),
		MakeTestCase(990_000, 13.2, 52.8),
		MakeTestCase(990_000, 10.2, 40.8),
		MakeTestCase(985_000, 12.9, 49.9875),
		MakeTestCase(985_000, 10.7, 41.4625),
		MakeTestCase(980_000, 12.9, 48.375),
		MakeTestCase(980_000, 10.7, 40.125),
		MakeTestCase(975_000, 8, 28.5),
		MakeTestCase(970_000, 8, 27.5),
		MakeTestCase(965_000, 13.6, 45.9),
		MakeTestCase(965_000, 12.2, 40),
		MakeTestCase(960_000, 9, 29.25),
		MakeTestCase(955_000, 8, 25),
		MakeTestCase(950_000, 8, 24),
		MakeTestCase(950_000, 12.2, 36.6),
		MakeTestCase(950_000, 12.2, 36.6),
		MakeTestCase(940_000, 8, 22),
		MakeTestCase(920_000, 8, 20),
		MakeTestCase(900_000, 8, 16),
		MakeTestCase(900_000, 13.8, 27.6),
		MakeTestCase(900_000, 13.8, 27.6),
		MakeTestCase(850_000, 8, 12),
		MakeTestCase(0, 10, 10),
	];

	for (const testCase of testCases) {
		testCase();
	}
});

test("WACCA Inverse Rate Validation Tests", () => {
	expectThrowsSnapshot(() => inverse(50, -1), "Should throw if level is negative.");
	expectThrowsSnapshot(() => inversePlus(50, -1), "Should throw if level is negative.");
	expectThrowsSnapshot(() => inverse(100, 1), "Should throw if rate is impossible.");
	expectThrowsSnapshot(() => inversePlus(100, 1), "Should throw if rate is impossible.");
});
