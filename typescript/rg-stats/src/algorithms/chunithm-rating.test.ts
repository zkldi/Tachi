import { expect, test } from "vitest";
import { expectThrowsSnapshot } from "../test-utils/throw-snapshot";
import { calculate } from "./chunithm-rating";

test("CHUNITHM Rating Tests", () => {
	const LEVEL = 12.5;
	expect(calculate(1_010_000, LEVEL)).toBe(LEVEL + 2.15);
	expect(calculate(1_007_500, LEVEL)).toBe(LEVEL + 2);
	expect(calculate(1_005_000, LEVEL)).toBe(LEVEL + 1.5);
	expect(calculate(1_000_000, LEVEL)).toBe(LEVEL + 1);
	expect(calculate(975_000, LEVEL)).toBe(LEVEL);
	expect(calculate(900_000, LEVEL)).toBe(LEVEL - 5);
	expect(calculate(800_000, LEVEL)).toBe(3.75);
	expect(calculate(500_000, LEVEL)).toBe(0);
	expect(calculate(0, LEVEL)).toBe(0);

	expect(calculate(987_000, LEVEL)).toBe(12.98);
	expect(calculate(1_008_000, LEVEL)).toBe(14.55);
	expect(calculate(1_003_000, LEVEL)).toBe(13.8);
	expect(calculate(999_000, LEVEL)).toBe(13.46);
	expect(calculate(980_000, LEVEL)).toBe(12.7);
	expect(calculate(950_000, LEVEL)).toBe(10.83);
	expect(calculate(810_000, LEVEL)).toBe(4.12);
	expect(calculate(600_000, LEVEL)).toBe(1.25);
	expect(calculate(50_000, LEVEL)).toBe(0);
});

test("CHUNITHM Rating Edge Cases", () => {
	expect(
		calculate(1_010_000, 0),
		"A perfect score on a chart with level 0 should be valid, and worth 0 + 2.15.",
	).toBe(2.15);
	expect(calculate(0, 12.5), "A score of 0 should be worth 0.").toBe(0);
	expect(calculate(0, 0), "A score of 0 on a chart with level 0 should be worth 0.").toBe(0);
});

test("CHUNITHM Rating Validation Tests", () => {
	expectThrowsSnapshot(() => calculate(-1, 12.5), "Should throw if your score is negative.");

	expectThrowsSnapshot(
		() => calculate(1_010_001, 12.5),
		"Should throw if your score is >= 1.01million.",
	);

	expectThrowsSnapshot(() => calculate(900_000, -1), "Should throw if chart level is negative.");
});
