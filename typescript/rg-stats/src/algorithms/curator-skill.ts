import { ThrowIf } from "../util/throw-if";

/**
 * Calculate MUSECA "Curator Skill" for a score.
 *
 * @param score - The score to calculate the skill rating for.
 * @param chartLevel - The level for this chart. Note that some charts are considered
 * to be level 16s, and you should pass 16 to this function instead.
 */
export function calculate(score: number, chartLevel: number): number {
	ThrowIf(score > 1_000_000, "Score cannot be greater than 1 million.", { score });
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(chartLevel, "Chart level cannot be negative.", { chartLevel });

	return Math.floor(chartLevel * (score / 10_000));
}

/**
 * Given a curator skill value, return the score necessary to get that skill
 * on a chart of the provided level. Throws if this is not possible.
 *
 * @param skill - The curator skill value to invert.
 * @param chartLevel - The difficulty of chart you'd want to achieve this skill value on.
 */
export function inverse(skill: number, chartLevel: number): number {
	const score = (skill / chartLevel) * 10_000;

	ThrowIf(
		score >= 1_000_000,
		`A skill level of ${skill} is not possible on a chart with level ${chartLevel}.`,
		{ skill, chartLevel },
	);

	return Math.ceil(score);
}
