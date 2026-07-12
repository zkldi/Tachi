import { ThrowIf } from "../util/throw-if";

const FLARE_0_POINTS = [
	145, 155, 170, 185, 205, 230, 255, 290, 335, 400, 465, 510, 545, 575, 600, 620, 635, 650, 665,
];

/**
 * Calculate DDR Flare for a score.
 *
 * @param internalChartLevel - The internal decimal level of the chart the score was achieved on.
 * @param flareLevel - The Flare level chosen to play the song. Goes from 0 ("Flare 0" or no Flare) to 10 ("Flare EX")
 */
export function calculate(internalChartLevel: number, flareLevel: number) {
	ThrowIf.negativeOrZero(internalChartLevel, "Internal chart level cannot be negative or zero.", {
		level: internalChartLevel,
	});
	ThrowIf(internalChartLevel > 19, "Internal chart level cannot be greater than 19", {
		level: internalChartLevel,
	});
	ThrowIf.negative(flareLevel, "Flare level cannot be negative.", {
		level: flareLevel,
	});
	ThrowIf(flareLevel > 10, "Flare level cannot be greater than 10.", {
		level: flareLevel,
	});

	return Math.floor((FLARE_0_POINTS[internalChartLevel - 1]! * (100 + flareLevel * 6)) / 100);
}
