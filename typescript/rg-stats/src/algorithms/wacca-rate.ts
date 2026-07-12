import { RoundToNDP } from "../util/math";
import { ThrowIf } from "../util/throw-if";
import { integer } from "../util/types";

/**
 * Calculates WACCAs rate for a score.
 * This is accurate as of Reverse.
 *
 * @param score - The score to calculate the rate for.
 * @param internalChartLevel - The internal decimal level of the chart the score was achieved on.
 */
export function calculate(score: integer, internalChartLevel: number) {
	ThrowIf(score > 1_000_000, "Score cannot be greater than 1million.", { score });
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		level: internalChartLevel,
	});

	let scoreCoef = 1;

	// Yes, this is really how it works.
	if (score >= 990_000) {
		scoreCoef = 4;
	} else if (score >= 980_000) {
		scoreCoef = 3.75;
	} else if (score >= 970_000) {
		scoreCoef = 3.5;
	} else if (score >= 960_000) {
		scoreCoef = 3.25;
	} else if (score >= 950_000) {
		scoreCoef = 3;
	} else if (score >= 940_000) {
		scoreCoef = 2.75;
	} else if (score >= 920_000) {
		scoreCoef = 2.5;
	} else if (score >= 900_000) {
		scoreCoef = 2;
	} else if (score >= 850_000) {
		scoreCoef = 1.5;
	}

	return RoundToNDP(scoreCoef * internalChartLevel, 3);
}

/**
 * Calculates WACCAs rate for a score.
 * This is accurate for WACCA Plus as of the August 2025 update.
 *
 * @param score - The score to calculate the rate for.
 * @param internalChartLevel - The internal decimal level of the chart the score was achieved on.
 */
export function calculatePlus(score: integer, internalChartLevel: number) {
	ThrowIf(score > 1_000_000, "Score cannot be greater than 1million.", { score });
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		level: internalChartLevel,
	});

	let scoreCoef = 1;

	// Yes, this is really how it works.
	if (score >= 995_000) {
		scoreCoef = 4.05;
	} else if (score >= 994_000) {
		scoreCoef = 4.04;
	} else if (score >= 993_000) {
		scoreCoef = 4.03;
	} else if (score >= 992_000) {
		scoreCoef = 4.02;
	} else if (score >= 991_000) {
		scoreCoef = 4.01;
	} else if (score >= 990_000) {
		scoreCoef = 4;
	} else if (score >= 985_000) {
		scoreCoef = 3.875;
	} else if (score >= 980_000) {
		scoreCoef = 3.75;
	} else if (score >= 975_000) {
		scoreCoef = 3.625;
	} else if (score >= 970_000) {
		scoreCoef = 3.5;
	} else if (score >= 965_000) {
		scoreCoef = 3.375;
	} else if (score >= 960_000) {
		scoreCoef = 3.25;
	} else if (score >= 955_000) {
		scoreCoef = 3.125;
	} else if (score >= 950_000) {
		scoreCoef = 3;
	} else if (score >= 940_000) {
		scoreCoef = 2.75;
	} else if (score >= 920_000) {
		scoreCoef = 2.5;
	} else if (score >= 900_000) {
		scoreCoef = 2;
	} else if (score >= 850_000) {
		scoreCoef = 1.5;
	}

	return RoundToNDP(scoreCoef * internalChartLevel, 3);
}

/**
 * Given a WACCA rate and a chart level, return the minimum score necessary to get
 * that rate.
 * This is accurate as of Reverse.
 *
 * @param rate - The rate to inverse
 * @param internalChartLevel - The internal decimal level of the chart the rate was on.
 */
export function inverse(rate: number, internalChartLevel: number) {
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		level: internalChartLevel,
	});

	// I know it seems arbitrary to round this to 4dp, but the issue is that
	// obviously correct things like 36.6/12.2 end up as 3.0000[...]4, which
	// causes this alg to fail.
	const scoreCoef = RoundToNDP(rate / internalChartLevel, 4);

	ThrowIf(
		scoreCoef > 4,
		`A rate of ${rate} is not possible on a chart of level ${internalChartLevel}.`,
		{
			rate,
			level: internalChartLevel,
		},
	);

	if (scoreCoef > 3.75) {
		return 990_000;
	} else if (scoreCoef > 3.5) {
		return 980_000;
	} else if (scoreCoef > 3.25) {
		return 970_000;
	} else if (scoreCoef > 3) {
		return 960_000;
	} else if (scoreCoef > 2.75) {
		return 950_000;
	} else if (scoreCoef > 2.5) {
		return 940_000;
	} else if (scoreCoef > 2) {
		return 920_000;
	} else if (scoreCoef > 1.5) {
		return 900_000;
	} else if (scoreCoef > 1) {
		return 850_000;
	}

	return 0;
}

/**
 * Given a WACCA rate and a chart level, return the minimum score necessary to get
 * that rate.
 * This is accurate for WACCA Plus as of the August 2025 update.
 *
 * @param rate - The rate to inverse
 * @param internalChartLevel - The internal decimal level of the chart the rate was on.
 */
export function inversePlus(rate: number, internalChartLevel: number) {
	ThrowIf.negative(internalChartLevel, "Chart level cannot be negative.", {
		level: internalChartLevel,
	});

	// I know it seems arbitrary to round this to 4dp, but the issue is that
	// obviously correct things like 36.6/12.2 end up as 3.0000[...]4, which
	// causes this alg to fail.
	const scoreCoef = RoundToNDP(rate / internalChartLevel, 4);

	ThrowIf(
		scoreCoef > 4.05,
		`A rate of ${rate} is not possible on a chart of level ${internalChartLevel}.`,
		{
			rate,
			level: internalChartLevel,
		},
	);

	if (scoreCoef > 4.04) {
		return 995_000;
	} else if (scoreCoef > 4.03) {
		return 994_000;
	} else if (scoreCoef > 4.02) {
		return 993_000;
	} else if (scoreCoef > 4.01) {
		return 992_000;
	} else if (scoreCoef > 4) {
		return 991_000;
	} else if (scoreCoef > 3.875) {
		return 990_000;
	} else if (scoreCoef > 3.75) {
		return 985_000;
	} else if (scoreCoef > 3.625) {
		return 980_000;
	} else if (scoreCoef > 3.5) {
		return 975_000;
	} else if (scoreCoef > 3.375) {
		return 970_000;
	} else if (scoreCoef > 3.25) {
		return 965_000;
	} else if (scoreCoef > 3.125) {
		return 960_000;
	} else if (scoreCoef > 3) {
		return 955_000;
	} else if (scoreCoef > 2.75) {
		return 950_000;
	} else if (scoreCoef > 2.5) {
		return 940_000;
	} else if (scoreCoef > 2) {
		return 920_000;
	} else if (scoreCoef > 1.5) {
		return 900_000;
	} else if (scoreCoef > 1) {
		return 850_000;
	}

	return 0;
}
