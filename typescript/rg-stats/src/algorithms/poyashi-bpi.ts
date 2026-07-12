import { LogToBase } from "../util/math";
import { ThrowIf } from "../util/throw-if";
import { integer } from "../util/types";

/**
 * Calculates the "Beat Performance Index" of an IIDX score.
 * this is a port of Poyashi's implementation.
 * https://github.com/potakusan/iidx_score_manager/blob/f21ba6b85fcc0bf8b7ca888fa2239a3951a9c9c2/src/components/bpi/index.tsx#L120
 *
 * @param yourEx Your EX score.
 * @param kaidenAverage The kaiden average EX score.
 * @param worldRecord The world record's EX score.
 * @param max The maximum amount of EX achievable on this chart.
 * @param powCoef What power the BPI should be raised to. This is arbitrary, and assigned on a per-song basis. Defaults to 1.175.
 * If powCoef is set to -1, it will be overrode to 1.175.
 *
 * @returns A number between -15 and 100. Unless your score is better than
 * the world record, in which case returns can be above 100.
 *
 * @edgecase Even though any score better than the world record *is* now the world record,
 * it takes around 6 months for the official data on the world record to be updated.
 * Since changing the worldRecord affects all scores on the chart, poyashi's
 * implementation just lets BPI exceed 100 until patched.
 *
 * @edgecase BPI is undefined for the case where the world record is equal to the
 * kaiden average.
 */
export function calculate(
	yourEx: integer,
	kaidenAverage: integer,
	worldRecord: integer,
	max: integer,
	powCoef: number | null,
) {
	let powCoefficient = powCoef ?? 1.175;
	if (powCoefficient === -1) {
		powCoefficient = 1.175;
	}

	AssertProvidedEXScores(kaidenAverage, worldRecord, max, powCoefficient);

	ThrowIf.not(Number.isSafeInteger(yourEx), "Provided EX was not an integer.", { yourEx });
	ThrowIf(yourEx > max, "Provided EX was greater than MAX.", { yourEx, max });
	ThrowIf.negative(yourEx, "Provided EX was negative.", { yourEx });

	ThrowIf(
		worldRecord === kaidenAverage,
		"BPI is undefined for the case where Kaiden Average equals the World Record",
		{ kaidenAverage, worldRecord },
	);

	const yourPGF = PikaGreatFunction(yourEx, max);
	const kaidenPGF = PikaGreatFunction(kaidenAverage, max);
	const wrPGF = PikaGreatFunction(worldRecord, max);

	// Work out the ratio of your PGF versus the kaiden PGF.
	const yourScorePrime = yourPGF / kaidenPGF;
	const wrScorePrime = wrPGF / kaidenPGF;

	const isWorseThanKavg = yourEx < kaidenAverage;

	const logExPrime = LogToBase(yourScorePrime, wrScorePrime);

	if (isWorseThanKavg) {
		// since logExPrime is negative (because yourScorePrime is between 0 and 1)
		// We can't raise it to a power natively, as -0.5 to the power of something
		// like 1.175 is imaginary.

		// To fix this, the poyashi implementation negates logExPrime
		// and raises it to the powCoef.
		const negativeRaisedValue = (-1 * logExPrime) ** powCoefficient;

		// and then negates it again when multiplying by 100.
		const bpi = 100 * -1 * negativeRaisedValue;

		if (bpi < -15) {
			return -15;
		}

		return bpi;
	} else {
		return 100 * logExPrime ** powCoefficient;
	}
}

/**
 * Calculates the "PGF" of an IIDX score. This returns a number that indicates how
 * many pgreats you are expected to get for every great.
 */
function PikaGreatFunction(score: integer, max: integer) {
	// if score === max, then the subsequent lines will involve a divide by zero
	// so we have to avoid that somehow.
	if (score === max) {
		// The poyashi implementation multiplies by 0.8 here for an unknown reason.
		//
		// This multiplication essentially asserts that on a perfect score on a chart with
		// 1000 notes, it expects every 1600(!!) notes you make a mistake.
		return max * 0.8;
	}

	const scorePercent = score / max;

	return 0.5 / (1 - scorePercent);
}

/**
 * Returns the EX Score necessary to achieve the provided BPI.
 *
 * @param bpi - The BPI you wish to find out how much ex is needed for.
 * @param kaidenAverage The kaiden average EX score.
 * @param worldRecord The world record's EX score.
 * @param powCoef What power the BPI should be raised to. This is arbitrary, and assigned on a per-song basis. Defaults to 1.175.
 * If powCoef is set to -1, it will be overrode to 1.175.
 *
 * @returns A number between 0 and `max`.
 *
 * @edgecase -15BPI is achievable by many possible EXs, since it is the lower bound
 * for any given chart. Passing -15 into the function will return the largest
 * possible exScore that results in -15BPI.
 */
export function inverse(
	bpi: number,
	kaidenAverage: integer,
	worldRecord: integer,
	max: integer,
	powCoef: number | null,
) {
	let powCoefficient = powCoef ?? 1.175;
	if (powCoefficient === -1) {
		powCoefficient = 1.175;
	}

	AssertProvidedEXScores(kaidenAverage, worldRecord, max, powCoefficient);

	ThrowIf(bpi < -15, "BPI must be greater than or equal to -15.", { bpi });

	const isWorseThanKavg = bpi < 0;

	let logExPrime;

	if (isWorseThanKavg) {
		logExPrime = -1 * (bpi / -100) ** (1 / powCoefficient);
	} else {
		logExPrime = (bpi / 100) ** (1 / powCoefficient);
	}

	const kaidenPGF = PikaGreatFunction(kaidenAverage, max);
	const wrPGF = PikaGreatFunction(worldRecord, max);

	const wrScorePrime = wrPGF / kaidenPGF;
	const exScorePrime = wrScorePrime ** logExPrime;

	const exScorePGF = exScorePrime * kaidenPGF;

	const exScore = InversePikaGreatFunction(exScorePGF, max);

	// This is because InversePGF can't correctly apply the 0.8x multiplier.
	// If your exScore ceil's to MAX, then the ex score needed to get this score is max.
	// note that this only applies to the case where bpi > 100.
	if (bpi > 100 && Math.ceil(exScore) === max) {
		return max;
	}

	return Math.round(exScore);
}

/**
 * Inverts the PGF by returning the EXScore necessary to get a given PGF.
 *
 * @see {PikaGreatFunction}
 */
function InversePikaGreatFunction(pgf: number, max: number) {
	return (pgf * max - 0.5 * max) / pgf;
}

/**
 * Apply assertions and constraints into values that BPI recieves.
 */
function AssertProvidedEXScores(
	kaidenAverage: integer,
	worldRecord: integer,
	max: integer,
	powCoef: number,
) {
	// Is integer?
	ThrowIf.not(Number.isSafeInteger(kaidenAverage), "Kaiden Average was not an integer.", {
		kaidenAverage,
	});
	ThrowIf.not(Number.isSafeInteger(worldRecord), "World Record was not an integer.", {
		worldRecord,
	});
	ThrowIf.not(Number.isSafeInteger(max), "MAX was not an integer.", { max });

	// Is bounded correctly?
	ThrowIf(kaidenAverage > max, "Kaiden Average was greater than MAX.", {
		kaidenAverage,
		max,
	});
	ThrowIf(worldRecord > max, "World Record was greater than MAX.", {
		worldRecord,
		max,
	});
	ThrowIf(kaidenAverage > worldRecord, "Kaiden Average was greater than WR.", {
		kaidenAverage,
		worldRecord,
	});
	ThrowIf.negativeOrZero(kaidenAverage, "Kaiden Average was negative or zero.", {
		kaidenAverage,
	});
	ThrowIf.negativeOrZero(max, "MAX was negative or zero.", { max });
	ThrowIf.negativeOrZero(powCoef, "Power Coefficient was not positive.", { powCoef });

	// This assertion never triggers, because WR has to be greater than KAVG, and KAVG
	// is non-negative.
	// ThrowIf.negativeOrZero(worldRecord, "World Record was negative or zero.", { worldRecord });

	// Other edge case -- WR == KAVG breaks BPI immediately.
	ThrowIf(
		worldRecord === kaidenAverage,
		"BPI is undefined for the case where Kaiden Average equals the World Record",
		{ kaidenAverage, worldRecord },
	);
}
