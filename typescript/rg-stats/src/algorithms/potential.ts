import { ThrowIf } from "../util/throw-if";

/**
 * Calculate Arcaea potential for a score.
 *
 * @param score - The score to calculate the potential for.
 * @param internalChartLevel - The internal decimal level of the chart the score was achieved on.
 */
export function calculate(score: number, internalChartLevel: number) {
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(internalChartLevel, "Internal chart level cannot be negative.", {
		level: internalChartLevel,
	});

	let potential = 0;

	if (score >= 10_000_000) {
		potential = internalChartLevel + 2;
	} else if (score >= 9_800_000) {
		potential = internalChartLevel + 1 + (score - 9_800_000) / 200_000;
	} else {
		potential = internalChartLevel + (score - 9_500_000) / 300_000;
	}

	return Math.max(potential, 0);
}
