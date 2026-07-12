import { describe, expect, it } from "vitest";

import {
	DeleteUndefinedProps,
	GetMillisecondsSince,
	IsValidURL,
	RoundToNDecimalPlaces,
} from "./misc";

describe("GetMillisecondsSince", () => {
	it("returns a number greater than 0", () => {
		const time = GetMillisecondsSince(10n);

		expect(typeof time).toBe("number");
		expect(time).toBeGreaterThan(0);
	});
});

describe("DeleteUndefinedProps", () => {
	it("removes undefined keys recursively", () => {
		const v = {
			a: 1,
			b: 2,
			c: undefined,
			d: {
				e: 3,
				f: undefined,
			},
		};

		DeleteUndefinedProps(v);

		expect(v).toEqual({
			a: 1,
			b: 2,
			d: {
				e: 3,
			},
		});
	});
});

describe("IsValidURL", () => {
	it("accepts common http(s) and custom-scheme URLs", () => {
		expect(IsValidURL("https://example.com")).toBe(true);
		expect(IsValidURL("http://example.com")).toBe(true);
		expect(IsValidURL("http://example.com/suburl")).toBe(true);
		expect(IsValidURL("http://example.com#href")).toBe(true);
		expect(IsValidURL("http://example.com?querystring")).toBe(true);
		// Non-http(s) matches return the RegExpExecArray from `.exec()` (truthy).
		expect(IsValidURL("tachi-fdsaf7324hf://example.com?querystring")).toBeTruthy();
	});

	it("rejects ftp URLs", () => {
		// Implementation uses `||` chains that can yield `null` for disallowed schemes.
		expect(IsValidURL("ftp://example.com")).toBeFalsy();
	});

	// expect(IsValidURL("http://example")).toBe(false) - lol this is valid???? insane.
	// expect(IsValidURL("http:/example.com")).toBe(false) - this is also valid, the JS URL parser is ridiculously lenient. Whatever.
});

describe("RoundToNDecimalPlaces", () => {
	it("rounds to N decimal places", () => {
		expect(RoundToNDecimalPlaces(10.4999999999, 1)).toBe(10.5);
		expect(RoundToNDecimalPlaces(10.4999999999, 2)).toBe(10.5);
		expect(RoundToNDecimalPlaces(10.4499999999, 2)).toBe(10.45);
		expect(RoundToNDecimalPlaces(10.4449999999, 3)).toBe(10.445);
		expect(RoundToNDecimalPlaces(10.4469999999, 3)).toBe(10.447);
	});
});
