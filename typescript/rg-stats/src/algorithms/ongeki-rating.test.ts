import { expect, test } from "vitest";
import fs from "node:fs";
import { expectThrowsSnapshot } from "../test-utils/throw-snapshot";
import { calculate, calculatePlatinum, calculateRefresh, OngekiNoteLamp } from "./ongeki-rating";

interface TestData {
	ratingRefresh: {
		internalChartLevel: number;
		technicalScore: number;
		noteLamp: OngekiNoteLamp;
		fullBell: boolean;
		expectedRating: number;
	}[];
	ratingPlatinum: {
		internalChartLevel: number;
		stars: number;
		expectedRating: number;
	}[];
}

test("O.N.G.E.K.I. Classic Rating Tests", () => {
	const LEVEL = 12.5;
	expect(calculate(1_010_000, LEVEL)).toBe(LEVEL + 2);
	expect(calculate(1_007_500, LEVEL)).toBe(LEVEL + 2);
	expect(calculate(1_000_000, LEVEL)).toBe(LEVEL + 1.5);
	expect(calculate(990_000, LEVEL)).toBe(LEVEL + 1);
	expect(calculate(970_000, LEVEL)).toBe(LEVEL);
	expect(calculate(900_000, LEVEL)).toBe(LEVEL - 4);
	expect(calculate(800_000, LEVEL)).toBe(LEVEL - 6);
	expect(calculate(500_000, LEVEL)).toBe(0);
	expect(calculate(0, LEVEL)).toBe(0);

	expect(calculate(987_000, LEVEL)).toBe(13.35);
	expect(calculate(1_003_000, LEVEL)).toBe(14.2);
	expect(calculate(999_000, LEVEL)).toBe(13.95);
	expect(calculate(994_000, LEVEL)).toBe(13.7);
	expect(calculate(980_000, LEVEL)).toBe(13);
	expect(calculate(950_000, LEVEL)).toBe(11.35);
	expect(calculate(600_000, LEVEL)).toBe(0);
	expect(calculate(50_000, LEVEL)).toBe(0);
});

test("O.N.G.E.K.I. Classic Rating Edge Cases", () => {
	expect(
		calculate(1_010_000, 0),
		"A perfect score on a chart with level 0 should be worth 0.",
	).toBe(0);
	expect(calculate(0, 12.5), "A score of 0 should be worth 0.").toBe(0);
	expect(calculate(0, 0), "A score of 0 on a chart with level 0 should be worth 0.").toBe(0);
	expect(calculate(1_007_880, 14.4), "An SSS+ on a 14.4 should be worth 16.4.").toBe(16.4);
});

test("O.N.G.E.K.I. Refresh Rating Tests", () => {
	const LEVEL = 12.5;
	expect(calculateRefresh(LEVEL, 1_010_000, "ALL BREAK+", true)).toBe(LEVEL + 2.7);
	expect(calculateRefresh(LEVEL, 970_000, "CLEAR", false)).toBe(LEVEL);
	expect(calculateRefresh(LEVEL, 970_000, "FULL COMBO", true)).toBe(LEVEL + 0.15);
	expect(calculateRefresh(LEVEL, 952_510, "LOSS", false)).toBe(LEVEL - 1);
	expect(calculateRefresh(LEVEL, 952_500, "LOSS", false)).toBe(LEVEL - 1);
	expect(calculateRefresh(LEVEL, 952_490, "LOSS", false)).toBe(LEVEL - 1.001);
	expect(calculateRefresh(LEVEL, 900_000, "LOSS", false)).toBe(LEVEL - 4);
	expect(calculateRefresh(LEVEL, 850_000, "LOSS", false)).toBe(LEVEL - 5);
	expect(calculateRefresh(LEVEL, 800_000, "CLEAR", true)).toBe(LEVEL - 6 + 0.05);
});

test("O.N.G.E.K.I. Refresh Rating Edge Cases", () => {
	expect(
		calculateRefresh(0, 1_010_000, "ALL BREAK+", true),
		"A perfect score on a chart with level 0 should be worth 0.",
	).toBe(0);
	expect(calculateRefresh(12.5, 0, "LOSS", false), "A score of 0 should be worth 0.").toBe(0);
	expect(
		calculateRefresh(0, 0, "LOSS", false),
		"A score of 0 on a chart with level 0 should be worth 0.",
	).toBe(0);
});

test("O.N.G.E.K.I. Refresh Rating Real-world Tests", () => {
	const testData: TestData = JSON.parse(
		fs.readFileSync("test-data/ongeki-rating.json").toString(),
	);

	for (const d of testData.ratingRefresh) {
		expect(
			calculateRefresh(d.internalChartLevel, d.technicalScore, d.noteLamp, d.fullBell),
			`${d.technicalScore} on a ${d.internalChartLevel} should be equal ${d.expectedRating}`,
		).toBe(d.expectedRating);
	}
});

test("O.N.G.E.K.I. Platinum Rating Real-world Tests", () => {
	const testData: TestData = JSON.parse(
		fs.readFileSync("test-data/ongeki-rating.json").toString(),
	);

	for (const d of testData.ratingPlatinum) {
		expect(
			calculatePlatinum(d.internalChartLevel, d.stars),
			`${d.stars} on a ${d.internalChartLevel} should be equal ${d.expectedRating}`,
		).toBe(d.expectedRating);
	}

	expect(calculatePlatinum(15.7, 0), "0 stars should always equal 0 rating").toBe(0);
});

test("O.N.G.E.K.I. Rating Validation Tests", () => {
	expectThrowsSnapshot(
		() => calculate(-1, 12.5),
		"Classic should throw if your score is negative.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(12.5, -1, "LOSS", false),
		"Refresh should throw if your score is negative.",
	);

	expectThrowsSnapshot(
		() => calculate(1_010_001, 12.5),
		"Classic should throw if your score is >= 1.01million.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(12.5, 1_010_001, "CLEAR", true),
		"Refresh should throw if your score is >= 1.01million.",
	);

	expectThrowsSnapshot(
		() => calculate(900_000, -1),

		"Classic should throw if chart level is negative.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(-1, 900_000, "CLEAR", false),
		"Refresh should throw if chart level is negative.",
	);

	expectThrowsSnapshot(
		() => calculatePlatinum(-1, 5),
		"Platinum should throw if chart level is negative.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(12.5, 900_000, "ALL BREAK+", true),
		"Refresh should throw if lamp is ALL BREAK+ without 1.01M.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(12.5, 1_010_000, "ALL BREAK", true),
		"Refresh should throw if your score is 1.01M without ALL BREAK+.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(12.5, 1_010_000, "ALL BREAK+", false),
		"Refresh should throw if your score is 1.01M without FULL BELL.",
	);

	expectThrowsSnapshot(
		() => calculateRefresh(12.5, 1_000_000, "LOSS", true),
		"Refresh should throw if your score is a LOSS FULL BELL.",
	);

	expectThrowsSnapshot(
		() => calculatePlatinum(12.5, -1),
		"Platinum should throw if star number is negative.",
	);

	expectThrowsSnapshot(() => calculatePlatinum(12.5, 7), "Platinum should throw if stars > 6.");
});
