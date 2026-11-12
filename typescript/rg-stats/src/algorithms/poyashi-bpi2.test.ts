import { expect, test } from "vitest";
import { calculate, type ChartParameters, inverse } from "./poyashi-bpi2";

const AA: ChartParameters = {
	notecount: 1834,
	worldRecord: 3660,
	coefficient: 1.039,
	mu: -6.0842,
	sigma: 0.6781,
};

test("calculates BPIM2's per-chart BPI V2 value", () => {
	expect(calculate(2800, AA)).toBe(-11.82);
	expect(calculate(AA.worldRecord!, AA)).toBe(100);
});

test("throws when required chart parameters are unavailable", () => {
	expect(() => calculate(2800, { ...AA, mu: null })).toThrow("Provided mu was null");
	expect(() => calculate(2800, { ...AA, sigma: null })).toThrow("Provided sigma was null");
	expect(() => calculate(2800, { ...AA, worldRecord: null })).toThrow(
		"Provided world record was null",
	);
});

test("validates chart parameters", () => {
	expect(() => calculate(100, { ...AA, notecount: 1.5 })).toThrow(
		"Provided note count was not an integer",
	);
	expect(() => calculate(0, { ...AA, notecount: 0 })).toThrow(
		"Provided note count was negative or zero",
	);
	expect(() => calculate(100, { ...AA, worldRecord: 1.5 })).toThrow(
		"Provided world record was not an integer",
	);
	expect(() => calculate(0, { ...AA, worldRecord: 0 })).toThrow(
		"Provided world record was negative or zero",
	);
	expect(() => calculate(100, { ...AA, worldRecord: AA.notecount * 2 + 1 })).toThrow(
		"Provided world record was greater than MAX",
	);
	expect(() => calculate(100, { ...AA, coefficient: Number.NaN })).toThrow(
		"Provided coefficient was not finite",
	);
	expect(() => calculate(100, { ...AA, coefficient: 0 })).toThrow(
		"Provided coefficient was negative or zero",
	);
	expect(calculate(2800, { ...AA, coefficient: null })).toBeTypeOf("number");
	expect(() => calculate(100, { ...AA, mu: Number.NaN })).toThrow("Provided mu was not finite");
	expect(() => calculate(100, { ...AA, sigma: Number.NaN })).toThrow(
		"Provided sigma was not finite",
	);
	expect(() => calculate(100, { ...AA, sigma: 0 })).toThrow(
		"Provided sigma was negative or zero",
	);

	const max = AA.notecount * 2;
	const wrT = -Math.log(max - AA.worldRecord!);
	const degenerateMu = wrT - AA.sigma! * -0.19383932671707751;
	expect(() => calculate(100, { ...AA, mu: degenerateMu })).toThrow(
		"Provided chart parameters produced degenerate BPI V2 anchors",
	);
});

test("validates EX scores", () => {
	expect(() => calculate(1.5, AA)).toThrow("Provided EX was not an integer");
	expect(() => calculate(-1, AA)).toThrow("Provided EX was negative");
	expect(() => calculate(AA.notecount * 2 + 1, AA)).toThrow("Provided EX was greater than MAX");
});

test("inverts BPI V2 targets", () => {
	const targetScore = inverse(50, AA);
	expect(calculate(targetScore, AA)).toBeGreaterThanOrEqual(50);
});

test("validates inverse BPI targets", () => {
	expect(() => inverse(Number.NaN, AA)).toThrow("Provided BPI was not finite");
	expect(() => inverse(-15.01, AA)).toThrow("Provided BPI was below the BPI floor");
});
