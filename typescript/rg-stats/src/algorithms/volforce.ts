import { GetEntriesAsArray } from "../util/misc";
import { ThrowIf } from "../util/throw-if";
import { integer } from "../util/types";

export type SDVXGrades = "D" | "C" | "B" | "A" | "A+" | "AA" | "AA+" | "AAA" | "AAA+" | "S";
export type SDVXLamps =
	| "FAILED"
	| "CLEAR"
	| "EXCESSIVE CLEAR"
	| "MAXXIVE CLEAR"
	| "ULTIMATE CHAIN"
	| "PERFECT ULTIMATE CHAIN";

const VF4GradeCoefficients: Record<SDVXGrades, number> = {
	S: 1.0,
	"AAA+": 0.99,
	AAA: 0.98,
	"AA+": 0.97,
	AA: 0.96,
	"A+": 0.95,
	A: 0.94,
	B: 0.93,
	C: 0.92,
	D: 0.91,
};

const VF5GradeCoefficients: Record<SDVXGrades, number> = {
	S: 105,
	"AAA+": 102,
	AAA: 100,
	"AA+": 97,
	AA: 94,
	// everything below this point is marked with a (?)
	// in bemaniwiki, so maybe it can't be trusted?
	"A+": 91,
	A: 88,
	B: 85,
	C: 82,
	D: 80,
};

const VF5LampCoefficients: Record<SDVXLamps, number> = {
	"PERFECT ULTIMATE CHAIN": 110,
	"ULTIMATE CHAIN": 105,
	"MAXXIVE CLEAR": 104,
	"EXCESSIVE CLEAR": 102,
	CLEAR: 100,
	FAILED: 50,
};

// NABLA buffed UC from 105 to 106, everything else matches VF6
const VF7LampCoefficients: Record<SDVXLamps, number> = {
	...VF5LampCoefficients,
	"ULTIMATE CHAIN": 106,
};

/**
 * Calculate VOLFORCE as it's defined in SDVX4.
 *
 * @param score - The user's score. Between 0 and 10million.
 * @param level - The level of the chart. Between 0 and 20, but this is not enforced.
 */
export function calculateVF4(score: integer, level: integer) {
	AssertProvidedScore(score);

	const grade = SDVXScoreToGrade(score);

	const gradeCoefficient = VF4GradeCoefficients[grade];

	return Math.floor(25 * (level + 1) * (score / 10_000_000) * gradeCoefficient);
}

/**
 * Given a VF4 value and a chart level, return what score is needed to get that
 * VF4.
 *
 * If the score needed is greater than 10million, this function will throw.
 **
 * @param vf4 - The VF4 to invert.
 * @param level - The level of the chart you're inverting for.
 */
export function inverseVF4(vf4: integer, level: integer) {
	const scoreTimesGradeCoef = (10_000_000 * vf4) / (25 * (level + 1));

	const score = AttemptGradeCoefficientDivide(scoreTimesGradeCoef, VF4GradeCoefficients);

	ThrowIf(score === null, `A VF4 of ${vf4} is not possible on a chart with level ${level}`, {
		vf4,
		level,
	});

	return score;
}

/**
 * Calculate VOLFORCE as it's defined in SDVX5.
 *
 * @param score - The user's score. Between 0 and 10million.
 * @param level - The level of the chart. Between 0 and 20, but this is not enforced.
 */
export function calculateVF5(score: integer, lamp: SDVXLamps, level: integer) {
	AssertProvidedScore(score);

	const unroundedVF5 = CalculateWholeVF5(score, lamp, level);

	return Math.floor(unroundedVF5 / 10000) / 100;
}

/**
 * Given a VF5 value and a chart level, return what score is needed to get that
 * VF5.
 *
 * If the score needed is greater than 10million, this function will throw.
 *
 * @param vf5 - The VF5 to invert.
 * @param lamp - The lamp for this score. This is necessary to know, as lampCoefficient
 * plays a part in VF5.
 * @param level - The level of the chart you're inverting for.
 */
export function inverseVF5(
	vf5: number,
	// Exclude PUC as input. It doesn't make sense as input, since the answer would
	// always be 10million.
	lamp: Exclude<SDVXLamps, "PERFECT ULTIMATE CHAIN">,
	level: integer,
) {
	const score = InvertUnroundedVF5(vf5, lamp, level);

	ThrowIf(score === null, `A VF5 of ${vf5} is not possible on a chart with level ${level}.`, {
		vf5,
		level,
	});

	return score;
}

/**
 * Calculate VOLFORCE as it's defined in SDVX6.
 *
 * @param score - The user's score. Between 0 and 10million.
 * @param level - The level of the chart. Between 0 and 20, but this is not enforced.
 */
export function calculateVF6(score: integer, lamp: SDVXLamps, level: number) {
	AssertProvidedScore(score);

	// levels can have decimals starting at nabla,
	// flooring it to get vf6 algorithm
	level = Math.floor(level);

	const unroundedVF5 = CalculateWholeVF5(score, lamp, level);

	// VF6 is just unroundedVF5 to 3 decimal places instead of 2.
	return Math.floor(unroundedVF5 / 1000) / 1000;
}

/**
 * Given a VF6 value and a chart level, return what score is needed to get that
 * VF5.
 *
 * If the score needed is greater than 10million, this function will throw.
 **
 * @param vf6 - The VF6 to invert.
 * @param lamp - The lamp for this score. This is necessary to know, as lampCoefficient
 * plays a part in VF6. Passing "PERFECT ULTIMATE CHAIN" as a lamp is invalid, as inverting
 * it into a score makes no sense.
 * @param level - The level of the chart you're inverting for.
 */
export function inverseVF6(
	vf6: number,
	// Exclude PUC as input. It doesn't make sense as input, since the answer would
	// always be 10million.
	lamp: Exclude<SDVXLamps, "PERFECT ULTIMATE CHAIN">,
	level: integer,
) {
	// note: this function is actually identical to inverseVF5, but with the caveat
	// that the error message is different.

	const score = InvertUnroundedVF5(vf6, lamp, level);

	ThrowIf(score === null, `A VF6 of ${vf6} is not possible on a chart with level ${level}.`, {
		vf6,
		level,
	});

	// guaranteed to not be null
	return score!;
}

/**
 * Calculate VOLFORCE as it's defined in SDVX7.
 *
 * @param score - The user's score. Between 0 and 10million.
 * @param level - The level of the chart. Between 0 and 20, but this is not enforced.
 */
export function calculateVF7(score: integer, lamp: SDVXLamps, level: number) {
	AssertProvidedScore(score);

	const vf7 = CalculateWholeVF7(score, lamp, level);

	// just like VF6, VF7 is unroundedVF5 rounded to 3 decimal places instead of 2.
	return Math.floor(vf7 / 1000) / 1000;
}

/**
 * Given a VF7 value and a chart level, return what score is needed to get that
 * VF5.
 *
 * If the score needed is greater than 10million, this function will throw.
 **
 * @param vf7 - The VF7 to invert.
 * @param lamp - The lamp for this score. This is necessary to know, as lampCoefficient
 * plays a part in VF6. Passing "PERFECT ULTIMATE CHAIN" as a lamp is invalid, as inverting
 * it into a score makes no sense.
 * @param level - The level of the chart you're inverting for.
 */
export function inverseVF7(
	vf7: number,
	// Exclude PUC as input. It doesn't make sense as input, since the answer would
	// always be 10million.
	lamp: Exclude<SDVXLamps, "PERFECT ULTIMATE CHAIN">,
	level: integer,
) {
	// note: this function is actually identical to inverseVF5, but with the caveat
	// that the error message is different.

	const score = InvertUnroundedVF7(vf7, lamp, level);

	ThrowIf(score === null, `A VF7 of ${vf7} is not possible on a chart with level ${level}.`, {
		vf7,
		level,
	});
	// guaranteed to not be null
	return score!;
}

/**
 * Calculate VF5 without performing any rounding. This is useful because VF5
 * is floored to 2 decimal places, wherease VF6 is floored to 3. This lets us
 * reuse the same algorithm.
 */
function CalculateWholeVF5(score: integer, lamp: SDVXLamps, level: integer) {
	const grade = SDVXScoreToGrade(score);

	const gradeCoefficient = VF5GradeCoefficients[grade];
	const lampCoefficient = VF5LampCoefficients[lamp];

	return level * 2 * (score / 10_000_000) * gradeCoefficient * lampCoefficient;
}

/**
 * Calculate VF7 without performing any rounding. This is the same as VF6
 * with the exception that the level can be a number and UCs have been buffed.
 */
function CalculateWholeVF7(score: integer, lamp: SDVXLamps, level: number) {
	const grade = SDVXScoreToGrade(score);

	const gradeCoefficient = VF5GradeCoefficients[grade];
	const lampCoefficient = VF7LampCoefficients[lamp];

	return level * 2 * (score / 10_000_000) * gradeCoefficient * lampCoefficient;
}

/**
 * Attempt to invert VF5 into a score.
 *
 * @returns The score if it was possible to be achieved. Else, it returns null.
 */
function InvertUnroundedVF5(vf5: number, lamp: SDVXLamps, level: integer) {
	// Note: PERFECT ULTIMATE CHAIN is never passed into this function from typescript
	// as the calling functions Exclude<T> it from the lamps.
	// However, a JS caller may call it like this anyway, so we mayaswell throw.
	ThrowIf(
		lamp === "PERFECT ULTIMATE CHAIN",
		"PERFECT ULTIMATE CHAIN as a lampCoefficient does not make sense for an inversion, since the answer would always be 10million.",
		{ lamp },
	);

	const lampCoefficient = VF5LampCoefficients[lamp];

	const scoreTimesGradeCoef = (1_000_000 * 10_000_000 * vf5) / (2 * level * lampCoefficient);

	const score = AttemptGradeCoefficientDivide(scoreTimesGradeCoef, VF5GradeCoefficients);

	return score;
}

/**
 * Attempt to invert VF7 into a score.
 *
 * @returns The score if it was possible to be achieved. Else, it returns null.
 */
function InvertUnroundedVF7(vf7: number, lamp: SDVXLamps, level: number) {
	// Note: PERFECT ULTIMATE CHAIN is never passed into this function from typescript
	// as the calling functions Exclude<T> it from the lamps.
	// However, a JS caller may call it like this anyway, so we mayaswell throw.
	ThrowIf(
		lamp === "PERFECT ULTIMATE CHAIN",
		"PERFECT ULTIMATE CHAIN as a lampCoefficient does not make sense for an inversion, since the answer would always be 10million.",
		{ lamp },
	);

	const lampCoefficient = VF7LampCoefficients[lamp];

	const scoreTimesGradeCoef = (1_000_000 * 10_000_000 * vf7) / (2 * level * lampCoefficient);

	const score = AttemptGradeCoefficientDivide(scoreTimesGradeCoef, VF5GradeCoefficients);

	return score;
}

/**
 * Convert a SDVX percent to the grade it represents.
 * @param score - The score to convert - between 0 and 10million.
 * @returns A string representing a grade.
 */
function SDVXScoreToGrade(score: integer): SDVXGrades {
	if (score < 7_000_000) {
		return "D";
	} else if (score < 8_000_000) {
		return "C";
	} else if (score < 8_700_000) {
		return "B";
	} else if (score < 9_000_000) {
		return "A";
	} else if (score < 9_300_000) {
		return "A+";
	} else if (score < 9_500_000) {
		return "AA";
	} else if (score < 9_700_000) {
		return "AA+";
	} else if (score < 9_800_000) {
		return "AAA";
	} else if (score < 9_900_000) {
		return "AAA+";
	}

	return "S";
}

/**
 * Given a SDVX grade, return the lower and upper bounds for scoring in this grade.
 * This is used to invert the gradeCoefficient function in volforce.
 *
 * Bounds are returned as lower <= k < upper.
 */
function SDVXGetGradeBoundaries(grade: SDVXGrades): { lower: integer; upper: integer } {
	if (grade === "S") {
		return { lower: 9_900_000, upper: 10_000_000 };
	} else if (grade === "AAA+") {
		return { lower: 9_800_000, upper: 9_900_000 };
	} else if (grade === "AAA") {
		return { lower: 9_700_000, upper: 9_800_000 };
	} else if (grade === "AA+") {
		return { lower: 9_500_000, upper: 9_700_000 };
	} else if (grade === "AA") {
		return { lower: 9_300_000, upper: 9_500_000 };
	} else if (grade === "A+") {
		return { lower: 9_000_000, upper: 9_300_000 };
	} else if (grade === "A") {
		return { lower: 8_700_000, upper: 9_000_000 };
	} else if (grade === "B") {
		return { lower: 8_000_000, upper: 8_700_000 };
	} else if (grade === "C") {
		return { lower: 7_000_000, upper: 8_000_000 };
	}

	return { lower: 0, upper: 7_000_000 };
}

/**
 * Assert necessary things about a provided score.
 */
function AssertProvidedScore(score: integer) {
	ThrowIf(score > 10_000_000, "Score cannot be greater than 10million", { score });
	ThrowIf.negative(score, "Score cannot be negative", { score });
}

/**
 * Go through all of the gradeBoundaries for a game and use them as guesses for score
 * values.
 *
 * This means we try dividing by all the gradeCoefficients until we find one
 * where the resulting score would have the same grade as the given coefficient.
 *
 * Used for inverting VF.
 *
 * @param scoreTimesGradeCoef - The expected score multiplied by the gradeCoefficient.
 * @param coefficients - A record of SDVXGrade -> gradeCoefficient
 * @returns The score divided by the gradeCoefficient. If not possible, this returns
 * null.
 */
function AttemptGradeCoefficientDivide(
	scoreTimesGradeCoef: number,
	coefficients: Record<SDVXGrades, number>,
) {
	for (const [grade, gradeCoef] of GetEntriesAsArray(coefficients).reverse()) {
		const maybeScore = scoreTimesGradeCoef / gradeCoef;

		const { lower, upper } = SDVXGetGradeBoundaries(grade);

		if (maybeScore <= lower) {
			return lower;
		} else if (maybeScore < upper || (maybeScore === upper && upper === 10_000_000)) {
			return Math.round(maybeScore);
		}
	}

	return null;
}
