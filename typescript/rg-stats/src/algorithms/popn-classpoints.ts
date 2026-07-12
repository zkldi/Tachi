import { ThrowIf } from "../util/throw-if";
import { integer } from "../util/types";

export type PopnLamps = "FAILED" | "EASY CLEAR" | "CLEAR" | "FULL COMBO" | "PERFECT";

/**
 * Calculate the pop'n class points for an individual score.
 *
 * @param score - The score value. Between 0 and 100k.
 * @param lamp - The lamp for this score.
 * @param level - The level for this chart. Typically between 1 and 50,
 * but the upper bound is not enforced here.
 */
export function calculate(score: integer, lamp: PopnLamps, level: integer) {
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf(score > 100_000, "Score cannot be better than 100k.", { score });
	ThrowIf.negative(level, "Chart level cannot be negative.", { level });

	if (score <= 50000) {
		return 0;
	}

	const clearBonus = GetClearBonus(lamp);

	return (10_000 * level + score - 50_000 + clearBonus) / 5440;
}

function GetClearBonus(lamp: PopnLamps) {
	if (lamp === "CLEAR" || lamp === "EASY CLEAR") {
		return 3000;
	} else if (lamp === "FULL COMBO" || lamp === "PERFECT") {
		return 5000;
	} else if (lamp === "FAILED") {
		return 0;
	}

	throw new Error(
		`Unknown lamp of ${lamp} passed to pop'n Class Points calculations. Expected any of FAILED, EASY CLEAR, CLEAR, FULL COMBO, PERFECT.`,
	);
}

/**
 * Given a pop'n class points value, expected lamp and chart level, return the
 * score necessary to get that amount of class points.
 *
 * @param classPoints - The class points to invert.
 * @param lamp - The lamp to invert for. The lamp affects how much score is needed
 * to achieve a given class points value.
 * @param level - The level for the chart. Typically between 1 and 50,
 * but the upper bound is not enforced here.
 */
export function inverse(classPoints: number, lamp: PopnLamps, level: integer) {
	ThrowIf.negative(level, "Chart level cannot be negative.", { level });

	if (classPoints === 0) {
		return 0;
	}

	const clearBonus = GetClearBonus(lamp);

	const expectedScore = 5440 * classPoints - 10_000 * level + 50_000 - clearBonus;

	ThrowIf(
		expectedScore > 100_000,
		`${classPoints} class points is not achievable on a chart with level ${level} and lamp ${lamp}.`,
		{ classPoints, level, lamp },
	);

	return Math.round(expectedScore);
}
