/**
 * The average value of each baseLevel. the first value should correspond to 1.5 on
 * the insane scale.
 *
 * We achieve this via linear interpolation between all these points. Since we have enough
 * points to do this reasonably, it works fine.
 */
// Here's some average sigmas we got from our initial tests with the insane table.
// const EC_CONSTANTS = [
// 	-4.489678583, // 1
// 	-3.514297762, // 2
// 	-2.992166987, // 3
// 	-2.603405337,
// 	-2.127131864,
// 	-1.710360701,
// 	-1.343979131,
// 	-1.107798763,
// 	-0.8070774572,
// 	-0.5626570675,
// 	-0.2711068634,
// 	0.2249717439,
// 	0.426367502,
// 	0.8257365093,
// 	1.039924494,
// 	1.29938196,
// 	1.615489641,
// 	1.93562607,
// 	2.433064014,
// 	2.674494597,
// 	3.036266494,
// 	3.749242559,
// 	4.395436558,
// 	4.9125179,
// 	6.070885183, // 25
// ];

import type { BMSTablesDataset } from "#types";

import { GetBaseline } from "#util";

export type EcConstants = Array<{
	averageSigma: number;
	levelName: string;
}>;

/**
 * Linearly interpolate between all AVG(sigma)s in each table. Rebase it ontop of
 * baseLevel. Profit.
 *
 * @param confidence - How far we should deviate from baseLevel. 1 implies we should
 * trust the sigma difference 100%, 50% implies we should apply 50% of the sigma
 * difference, so on.
 */
export function lerpBetwixt(value: number, EC_CONSTANTS: EcConstants, table: BMSTablesDataset) {
	for (let i = 0; i < EC_CONSTANTS.length; i++) {
		if (value < EC_CONSTANTS[i]!.averageSigma) {
			let upperIndex;
			let lowerIndex;

			// if i is 0, extend lerp from 0th index to 1st, instead of trying
			// to fetch a -1th value.

			// as in, continue drawing a straight line from the 1st average sigma
			// through the 0th average sigma.
			if (i === 0) {
				upperIndex = i + 1;
				lowerIndex = i;
			} else {
				upperIndex = i;
				lowerIndex = i - 1;
			}

			const n0 = EC_CONSTANTS[lowerIndex]!.averageSigma;
			const n1 = EC_CONSTANTS[upperIndex]!.averageSigma;

			const v0 = GetBaseline(table, EC_CONSTANTS[lowerIndex]!.levelName);
			const v1 = GetBaseline(table, EC_CONSTANTS[upperIndex]!.levelName);

			if (v0 === null || v1 === null) {
				throw new Error(
					`Couldn't resolve a baseline for ${
						EC_CONSTANTS[lowerIndex]!.levelName
					} and/or ${EC_CONSTANTS[upperIndex]!.levelName} in ${table.name}`,
				);
			}

			let t = Math.abs((value - n0) / (n1 - n0));

			// if i is 0 we're before the first EC_CONSTANT, and therefore
			// should extend negatively.
			if (i === 0) {
				t = t * -1;
			}

			return v0 + t * (v1 - v0);
		}
	}

	// if we get to this point we're beyond the final ec constant
	// extend the lerp from n-1 to n.

	// as in, continue drawing a straight line from the n-1th avgSigma
	// and the nth.
	const upperIndex = EC_CONSTANTS.length - 1;
	const lowerIndex = EC_CONSTANTS.length - 2;

	const n0 = EC_CONSTANTS[lowerIndex]!.averageSigma;
	const n1 = EC_CONSTANTS[upperIndex]!.averageSigma;

	const v0 = GetBaseline(table, EC_CONSTANTS[lowerIndex]!.levelName);
	const v1 = GetBaseline(table, EC_CONSTANTS[upperIndex]!.levelName);

	if (v0 === null || v1 === null) {
		throw new Error(
			`Couldn't resolve a baseline for ${EC_CONSTANTS[lowerIndex]!.levelName} and/or ${
				EC_CONSTANTS[upperIndex]!.levelName
			} in ${table.name}`,
		);
	}

	const t = Math.abs((value - n0) / (n1 - n0));

	return v1 + t * (v1 - v0);
}
