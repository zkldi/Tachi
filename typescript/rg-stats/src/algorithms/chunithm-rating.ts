import { ThrowIf } from "../util/throw-if";

/**
 * Calculates the rating for a CHUNITHM score.
 * This is accurate up to SUN.
 *
 * @param score - The score the user got. This is a value between 0 and 1.01million.
 * @param internalChartLevel - The internal chart level. This is a decimal value stored by the game internally.
 */
export function calculate(score: number, internalChartLevel: number) {
	const levelBase = internalChartLevel * 100;

	ThrowIf(score > 1_010_000, "Score cannot be greater than 1.01Million.", { score });
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", { internalChartLevel });

	let val = 0;

	if (score >= 1_009_000) {
		val = levelBase + 215;
	} else if (score >= 1_007_500) {
		val = levelBase + 200 + (score - 1_007_500) / 100;
	} else if (score >= 1_005_000) {
		val = levelBase + 150 + ((score - 1_005_000) * 10) / 500;
	} else if (score >= 1_000_000) {
		val = levelBase + 100 + ((score - 1_000_000) * 5) / 500;
	} else if (score >= 975_000) {
		val = levelBase + ((score - 975_000) * 2) / 500;
	} else if (score >= 900_000) {
		val = levelBase - 500 + ((score - 900_000) * 2) / 300;
	} else if (score >= 800_000) {
		val = (levelBase - 500) / 2 + ((score - 800_000) * ((levelBase - 500) / 2)) / 100_000;
	} else if (score >= 500_000) {
		val = (((levelBase - 500) / 2) * (score - 500_000)) / 300_000;
	}

	return Math.max(Math.floor(val) / 100, 0);
}
