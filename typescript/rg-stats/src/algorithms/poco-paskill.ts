/**
 * Calculates the formula for the PA Skill of a Polaris Chord chart
 * @param percent - The ACHIEVEMENT RATR of the score.
 * @param levelNum - The level number of the chart.
 * @returns The skill value of the score.
 */
export function calculate(percent: number, levelNum: number): number {
	let modifier = 0;

	if (percent >= 100) {
		modifier = 2.3;
	} else if (percent >= 99.5) {
		modifier = 2.0 + (percent - 99.5) * 0.6;
	} else if (percent >= 98.0) {
		modifier = 0.5 + (percent - 98.0) * 1.0;
	} else if (percent >= 95.0) {
		modifier = 0.0 + (percent - 95.0) * (0.5 / 3.0);
	} else if (percent >= 85.0) {
		modifier = -1.0 + (percent - 85.0) * 0.1;
	} else if (percent >= 80.0) {
		const at80 = -(levelNum + 3) / 4.0;
		const slope = (-1.0 - at80) / 5.0;
		modifier = at80 + (percent - 80.0) * slope;
	} else if (percent >= 50.0) {
		const at50 = -levelNum;
		const at80 = -(levelNum + 3) / 4.0;
		const slope = (at80 - at50) / 30.0;
		modifier = at50 + (percent - 50.0) * slope;
	} else {
		modifier = -levelNum;
	}

	return Number((levelNum + modifier).toFixed(5));
}
