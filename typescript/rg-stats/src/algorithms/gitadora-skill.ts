import { ThrowIf } from "../util/throw-if";

/**
 * Calculate a GITADORA Skill value.
 *
 * @param scorePercent - The percent this score was worth. Must be between 0 and 100.
 * @param level - The level for this chart.
 */
export function calculate(scorePercent: number, level: number) {
	ThrowIf(scorePercent > 100, "Score Percent cannot be greater than 100.", { scorePercent });
	ThrowIf.negative(scorePercent, "Score Percent cannot be negative.", { scorePercent });
	ThrowIf.negative(level, "Chart Level cannot be negative.", { level });

	const trueRating = scorePercent * level * 20;

	return Math.floor(trueRating) / 100;
}

/**
 * Given a GITADORA Skill and a level of a chart, return the percent necessary
 * to achieve that skill value.
 *
 * This throws if the skill value is not possible.
 *
 * @param skill - The skill level to invert.
 * @param level - The level of the chart this skill level should be inverted for.
 */
export function inverse(skill: number, level: number) {
	ThrowIf.negative(skill, "Skill cannot be negative.", { skill });
	ThrowIf.negative(level, "Chart Level cannot be negative.", { level });

	const percent = (100 * skill) / (20 * level);

	ThrowIf(
		percent > 100,
		`A skill level of ${skill} is not possible on a chart with level ${level}.`,
		{ skill, level },
	);

	return percent;
}
