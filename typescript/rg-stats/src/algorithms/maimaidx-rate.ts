import { ThrowIf } from "../util/throw-if";

export type MaimaiDXLamps =
	| "FAILED"
	| "CLEAR"
	| "FULL COMBO"
	| "FULL COMBO+"
	| "ALL PERFECT"
	| "ALL PERFECT+";

const RATING_COEFFICIENTS = new Map([
	[100_5000, 224],
	[100_4999, 222],
	[100_0000, 216],
	[99_9999, 214],
	[99_5000, 211],
	[99_0000, 208],
	[98_9999, 206],
	[98_0000, 203],
	[97_0000, 200],
	[96_9999, 176],
	[94_0000, 168],
	[90_0000, 152],
	[80_0000, 136],
	[79_9999, 128],
	[75_0000, 120],
	[70_0000, 112],
	[60_0000, 96],
	[50_0000, 80],
	[40_0000, 64],
	[30_0000, 48],
	[20_0000, 32],
	[10_0000, 16],
	[0, 0],
]);

/**
 * Calculate maimai DX Splash+ (and newer) rate for a score.
 *
 * @param score - The score to calculate the rate for.
 * @param internalChartLevel - The internal decimal level of the chart the score was achieved on.
 * @param lamp - The lamp for this score. Since maimai DX CiRCLE, there is a 1 rating bonus
 * for ALL PERFECT/ALL PERFECT+ scores.
 */
export function calculate(score: number, internalChartLevel: number, lamp?: MaimaiDXLamps) {
	ThrowIf(score > 101, "Score cannot be greater than 101%.", { score });
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(internalChartLevel, "Internal chart level cannot be negative.", {
		level: internalChartLevel,
	});
	ThrowIf(
		lamp === "ALL PERFECT+" && score !== 101,
		"Cannot have an ALL PERFECT+ without 101%.",
		// @ts-expect-error Lamp is "ALL PERFECT+" if the exception is thrown.
		{ score, lamp },
	);
	ThrowIf(
		score === 101 && lamp !== undefined && lamp !== "ALL PERFECT+",
		"A score of 101% should be an ALL PERFECT+.",
		// @ts-expect-error Lamp is defined if the exception is thrown.
		{ score, lamp },
	);
	ThrowIf(
		lamp === "ALL PERFECT" && score < 100,
		"Cannot have an ALL PERFECT without at least 100%.",
		// @ts-expect-error Lamp is "ALL PERFECT" if the exception is thrown.
		{ score, lamp },
	);
	ThrowIf(
		score >= 80 && lamp === "FAILED",
		"A score of >=80% should not be a FAILED.",
		// @ts-expect-error Lamp is "FAILED" if the exception is thrown.
		{ score, lamp },
	);
	ThrowIf(
		score < 80 && lamp === "CLEAR", // check specifically CLEARs so that sub-80% FCs are still permitted
		"A score of <80% should not be a CLEAR.",
		// @ts-expect-error Lamp is "CLEAR" if the exception is thrown.
		{ score, lamp },
	);

	// Scores above 100.5% are capped at 100.5% by the algorithm.
	const scoreInt = Math.min(Math.round(score * 10000), 100_5000);
	const iclInt = Math.round(internalChartLevel * 10);
	const bonus = lamp === "ALL PERFECT" || lamp === "ALL PERFECT+" ? 1 : 0;

	const coeffs = [...RATING_COEFFICIENTS];
	// Last entry is boundary 0. Omitting it from the loop avoids an impossible
	// branch (scoreInt < 0) on the final `scoreInt >= scoreBoundary` check.
	for (let i = 0; i < coeffs.length - 1; i++) {
		const [scoreBoundary, coefficient] = coeffs[i];
		if (scoreInt >= scoreBoundary) {
			return Math.floor((scoreInt * coefficient * iclInt) / 100_000_000) + bonus;
		}
	}
	const [, coefficient] = coeffs[coeffs.length - 1];
	return Math.floor((scoreInt * coefficient * iclInt) / 100_000_000) + bonus;
}
