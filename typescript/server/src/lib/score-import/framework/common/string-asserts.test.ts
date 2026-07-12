import { describe, expect, it } from "vitest";

import { InvalidScoreFailure } from "./converter-failures";
import { AssertStrAsPositiveInt, AssertStrAsPositiveNonZeroInt } from "./string-asserts";

function astr(v: string) {
	try {
		return AssertStrAsPositiveInt(v, "err");
	} catch (e) {
		return e;
	}
}

function astrp(v: string) {
	try {
		return AssertStrAsPositiveNonZeroInt(v, "err");
	} catch (e) {
		return e;
	}
}

describe("AssertStrAsPositiveInt", () => {
	it("rejects invalid inputs", () => {
		expect(astr("---")).toEqual(new InvalidScoreFailure(`err (Not an integer -- ---.)`));
		expect(astr("1.4")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 1.4.)`));
		expect(astr("NaN")).toEqual(new InvalidScoreFailure(`err (Not an integer -- NaN.)`));
		expect(astr("-0.3")).toEqual(new InvalidScoreFailure(`err (Not an integer -- -0.3.)`));
		expect(astr("0xFF")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 0xFF.)`));
		expect(astr("0b11")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 0b11.)`));
		expect(astr("0o77")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 0o77.)`));
		expect(astr("--1")).toEqual(new InvalidScoreFailure(`err (Not an integer -- --1.)`));
		expect(astr("12f")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 12f.)`));
		expect(astr(`${Number.MAX_SAFE_INTEGER.toString()}000`)).toEqual(
			new InvalidScoreFailure(
				`err (Not an integer -- ${Number.MAX_SAFE_INTEGER.toString()}000.)`,
			),
		);
		expect(astr("-1")).toEqual(new InvalidScoreFailure(`err (Was negative -- -1.)`));
	});

	it("accepts valid values", () => {
		// Number("-0") is -0; strict equality still treats it as zero.
		expect(astr("-0") === 0).toBe(true);
		expect(astr("0")).toBe(0);
		expect(astr("13")).toBe(13);
	});
});

describe("AssertStrAsPositiveNonZeroInt", () => {
	it("rejects invalid inputs", () => {
		expect(astrp("---")).toEqual(new InvalidScoreFailure(`err (Not an integer -- ---.)`));
		expect(astrp("1.4")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 1.4.)`));
		expect(astrp("NaN")).toEqual(new InvalidScoreFailure(`err (Not an integer -- NaN.)`));
		expect(astrp("-0.3")).toEqual(new InvalidScoreFailure(`err (Not an integer -- -0.3.)`));
		expect(astrp("0xFF")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 0xFF.)`));
		expect(astrp("0b11")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 0b11.)`));
		expect(astrp("0o77")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 0o77.)`));
		expect(astrp("--1")).toEqual(new InvalidScoreFailure(`err (Not an integer -- --1.)`));
		expect(astrp("12f")).toEqual(new InvalidScoreFailure(`err (Not an integer -- 12f.)`));
		expect(astrp(`${Number.MAX_SAFE_INTEGER.toString()}000`)).toEqual(
			new InvalidScoreFailure(
				`err (Not an integer -- ${Number.MAX_SAFE_INTEGER.toString()}000.)`,
			),
		);
		expect(astrp("-1")).toEqual(new InvalidScoreFailure(`err (Was negative or zero -- -1.)`));
		expect(astrp("-0")).toEqual(new InvalidScoreFailure(`err (Was negative or zero -- 0.)`));
		expect(astrp("0")).toEqual(new InvalidScoreFailure(`err (Was negative or zero -- 0.)`));
	});

	it("accepts positive non-zero integers", () => {
		expect(astrp("13")).toBe(13);
	});
});
