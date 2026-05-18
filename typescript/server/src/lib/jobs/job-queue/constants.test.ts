import { describe, expect, it } from "vitest";

import {
	computeBackoffDelayMs,
	SCORE_IMPORT_409_MAX_RETRIES,
	SCORE_IMPORT_409_RETRY_BASE_MS,
	SCORE_IMPORT_409_RETRY_MAX_DELAY_MS,
} from "./constants";

describe("computeBackoffDelayMs", () => {
	it("returns BASE_MS for the first attempt (failedAttempts = 0)", () => {
		const delay = computeBackoffDelayMs(0);
		// ±10% jitter of BASE_MS
		expect(delay).toBeGreaterThanOrEqual(Math.round(SCORE_IMPORT_409_RETRY_BASE_MS * 0.9));
		expect(delay).toBeLessThanOrEqual(Math.round(SCORE_IMPORT_409_RETRY_BASE_MS * 1.1));
	});

	it("doubles on each attempt", () => {
		// At attempt 1, base = BASE_MS * 2; at attempt 2, base = BASE_MS * 4.
		// Both are well below the max delay cap, so only jitter can affect them.
		const delay1 = computeBackoffDelayMs(1);
		const delay2 = computeBackoffDelayMs(2);
		const base1 = SCORE_IMPORT_409_RETRY_BASE_MS * 2;
		const base2 = SCORE_IMPORT_409_RETRY_BASE_MS * 4;
		expect(delay1).toBeGreaterThanOrEqual(Math.round(base1 * 0.9));
		expect(delay1).toBeLessThanOrEqual(Math.round(base1 * 1.1));
		expect(delay2).toBeGreaterThanOrEqual(Math.round(base2 * 0.9));
		expect(delay2).toBeLessThanOrEqual(Math.round(base2 * 1.1));
	});

	it("is capped at MAX_DELAY_MS (±10% jitter)", () => {
		// Large failedAttempts that would otherwise produce a huge delay.
		const delay = computeBackoffDelayMs(100);
		expect(delay).toBeLessThanOrEqual(Math.round(SCORE_IMPORT_409_RETRY_MAX_DELAY_MS * 1.1));
		expect(delay).toBeGreaterThanOrEqual(Math.round(SCORE_IMPORT_409_RETRY_MAX_DELAY_MS * 0.9));
	});

	it("never returns a negative value", () => {
		for (let i = 0; i <= SCORE_IMPORT_409_MAX_RETRIES + 5; i++) {
			expect(computeBackoffDelayMs(i)).toBeGreaterThan(0);
		}
	});
});
