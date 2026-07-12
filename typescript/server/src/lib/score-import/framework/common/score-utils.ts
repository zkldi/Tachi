import type { integer } from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

import { InvalidScoreFailure } from "./converter-failures";

/**
 * Parses and validates a date from a string.
 * @returns Milliseconds from the unix epoch, or null if the initial argument was null or undefined.
 */
export function ParseDateFromString(str: string | null | undefined): number | null {
	if (!str) {
		return null;
	}

	const date = Date.parse(str);

	if (Number.isNaN(date)) {
		throw new InvalidScoreFailure(`Invalid/Unparsable score timestamp of ${str}.`);
	}

	return date;
}

/**
 * Turn a museca score into its lamp. Note that we disagree with the game on what
 * constitutes a clear -- instead, 800k is marked as the minimum point for a clear.
 *
 * Museca actually handles clears differently with a bunch of grafica nonsense,
 * but nobody actually cares about it, so...
 */
export function MusecaGetLamp(score: integer, missCount: integer): GetEnumValue<"museca", "lamp"> {
	if (score === 1_000_000) {
		return "PERFECT CONNECT ALL";
	} else if (missCount === 0) {
		return "CONNECT ALL";
	} else if (score >= 800_000) {
		return "CLEAR";
	}

	return "FAILED";
}

export function JubeatGetLamp(score: integer, missCount: integer): GetEnumValue<"jubeat", "lamp"> {
	if (score === 1_000_000) {
		return "EXCELLENT";
	} else if (missCount === 0) {
		return "FULL COMBO";
	} else if (score >= 700_000) {
		return "CLEAR";
	}

	return "FAILED";
}
