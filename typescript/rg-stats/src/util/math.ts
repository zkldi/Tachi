import { integer } from "./types";

/**
 * Logarithm a number to any base.
 * @param number - The number to logarithm.
 * @param base - The base to log to.
 *
 * Uses this identity:
 * loga(n) = logb(n) / logb(a)
 * we use logb = ln, just because it's right there.
 */
export function LogToBase(number: number, base: number) {
	return Math.log(number) / Math.log(base);
}

/**
 * Round a number to N decimal places.
 *
 * @example `RoundToNDP(1.594, 1) -> 1.6`
 * @example `RoundToNDP(1.591, 2) -> 1.69`
 *
 * @param number - The number to round.
 * @param dp - The amount of decimal places to round to.
 */
export function RoundToNDP(number: number, dp: integer) {
	const mul = 10 ** dp;
	return Math.round(number * mul) / mul;
}
