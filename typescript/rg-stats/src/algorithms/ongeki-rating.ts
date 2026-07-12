import { ThrowIf } from "../util/throw-if";

export type OngekiNoteLamp = "LOSS" | "CLEAR" | "FULL COMBO" | "ALL BREAK" | "ALL BREAK+";

/**
 * Calculates the rating for an O.N.G.E.K.I. score.
 * This is accurate up to bright MEMORY Act.3.
 *
 * @param technicalScore - The technical score the user got. This is a value between 0 and 1.01million.
 * @param internalChartLevel - The internal chart level. This is a decimal value stored by the game internally.
 */
export function calculate(technicalScore: number, internalChartLevel: number) {
	ThrowIf(technicalScore > 1_010_000, "Technical score cannot be greater than 1.01Million.", {
		technicalScore,
	});
	ThrowIf.negative(technicalScore, "Technical score cannot be negative.", {
		technicalScore,
	});
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		internalChartLevel,
	});

	if (internalChartLevel === 0) {
		return 0;
	}

	let ratingValue = 0;
	const iclInt = Math.round(internalChartLevel * 100.0);

	if (technicalScore >= 1_007_500) {
		ratingValue = iclInt + 200;
	} else if (technicalScore >= 1_000_000) {
		ratingValue = iclInt + 150 + Math.floor((technicalScore - 1_000_000) / 150);
	} else if (technicalScore >= 970_000) {
		ratingValue = iclInt + Math.floor((technicalScore - 970_000) / 200);
	} else if (technicalScore >= 900000) {
		ratingValue = iclInt - Math.ceil((970_000 - technicalScore) / 175);
	} else if (technicalScore >= 800000) {
		ratingValue = iclInt - 400 - Math.ceil((900_000 - technicalScore) / 500);
	}

	return Math.max(ratingValue / 100.0, 0);
}

/**
 * Calculates the rating for an O.N.G.E.K.I. score.
 * This is accurate as of Re:Fresh.
 *
 * @param internalChartLevel - The internal chart level. This is a decimal value stored by the game internally.
 * @param technicalScore - The technical score the user got. This is a value between 0 and 1.01million.
 * @param noteLamp - The note lamp
 * @param fullBell - Whether the bell lamp is "FULL BELL"
 */
export function calculateRefresh(
	internalChartLevel: number,
	technicalScore: number,
	noteLamp: OngekiNoteLamp,
	fullBell: boolean,
) {
	ThrowIf(technicalScore > 1_010_000, "Technical score cannot be greater than 1.01Million.", {
		technicalScore,
	});
	ThrowIf.negative(technicalScore, "Technical score cannot be negative.", {
		technicalScore,
	});
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		internalChartLevel,
	});
	ThrowIf(
		technicalScore === 1_010_000 && (!fullBell || noteLamp !== "ALL BREAK+"),
		"Invalid AB+",
		{ fullBell: `${fullBell}`, noteLamp },
	);
	ThrowIf(technicalScore < 1_010_000 && noteLamp === "ALL BREAK+", "Invalid AB+", {
		fullBell: `${fullBell}`,
		noteLamp,
	});
	ThrowIf(noteLamp === "LOSS" && fullBell, "Cannot have a LOSS FULL BELL", { noteLamp });

	if (internalChartLevel === 0) {
		return 0;
	}

	const iclInt = Math.round(internalChartLevel * 1000.0);

	let ratingValue = iclInt;

	if (technicalScore >= 1_007_500) {
		ratingValue += 1750 + Math.trunc((250 * (technicalScore - 1_007_500)) / 2500);

		// SSS+ bonus
		ratingValue = ratingValue + 300;
	} else if (technicalScore >= 1_000_000) {
		ratingValue += 1250 + Math.trunc((500 * (technicalScore - 1_000_000)) / 7500);

		// SSS bonus
		ratingValue = ratingValue + 200;
	} else if (technicalScore >= 990_000) {
		ratingValue += 750 + Math.trunc((500 * (technicalScore - 990_000)) / 10000);

		// SS bonus
		ratingValue = ratingValue + 100;
	} else if (technicalScore >= 970_000) {
		ratingValue += Math.floor((750 * (technicalScore - 970_000)) / 20000);
	} else if (technicalScore >= 900_000) {
		ratingValue -= Math.ceil((4000 * (970_000 - technicalScore)) / 70000);
	} else if (technicalScore >= 800_000) {
		ratingValue -= 4000 + Math.ceil((2000 * (900_000 - technicalScore)) / 100000);
	} else {
		return 0;
	}

	if (fullBell) {
		ratingValue += 50;
	}

	if (noteLamp === "FULL COMBO") {
		ratingValue += 100;
	} else if (noteLamp === "ALL BREAK") {
		ratingValue += 300;
	} else if (noteLamp === "ALL BREAK+") {
		ratingValue += 350;
	}

	return Math.max(ratingValue / 1000.0, 0);
}

/**
 * Calculates the star rating for an O.N.G.E.K.I. score.
 * This is accurate as of Re:Fresh.
 *
 * @param internalChartLevel - The internal chart level. This is a decimal value stored by the game internally.
 * @param stars - The number of stars, 0-6 with 6 being "rainbow 5-stars"
 */
export function calculatePlatinum(internalChartLevel: number, stars: number) {
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		internalChartLevel,
	});
	ThrowIf(stars < 0 || stars > 6, "Invalid number of stars", { stars });

	// Rainbow 5-stars have the same rating value as regular 5-stars
	if (stars === 6) {
		stars = 5;
	}

	return Math.floor(stars * internalChartLevel * internalChartLevel) / 1000.0;
}
