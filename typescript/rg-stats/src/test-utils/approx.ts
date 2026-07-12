/* istanbul ignore file */

import { expect } from "vitest";

/**
 * Tests whether a number is approximately equal to another number.
 */
export function isAprx(value: number, expected: number, msg: string, decimalPlaces = 2) {
	const lim = 1 / 10 ** decimalPlaces;

	const aprx = Math.abs(value - expected) < lim;

	expect(aprx, `${msg} Got ${value}, Expected ${expected}.`).toBe(true);
}
