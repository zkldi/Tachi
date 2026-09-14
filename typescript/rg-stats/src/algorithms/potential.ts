import { ThrowIf } from "../util/throw-if";

export type ArcaeaLamp =
	| "LOST"
	| "CLEAR"
	| "EASY CLEAR"
	| "HARD CLEAR"
	| "FULL RECALL"
	| "PURE MEMORY";

/**
 * Calculate Arcaea potential for a score.
 *
 * @param score - The score to calculate the potential for.
 * @param internalChartLevel - The internal decimal level of the chart the score was achieved on.
 * @param lamp - The lamp of this score. As of Arcaea 7.0, this determines the +0.2 clear bonus.
 */
export function calculate(score: number, internalChartLevel: number, lamp: ArcaeaLamp) {
	ThrowIf.negative(score, "Score cannot be negative.", { score });
	ThrowIf.negative(internalChartLevel, "Internal chart level cannot be negative.", {
		level: internalChartLevel,
	});
	ThrowIf(
		lamp === "PURE MEMORY" && score < 10_000_000,
		"PURE MEMORY cannot be below 10 million.",
		{ score, lamp },
	);
	ThrowIf(
		lamp !== "PURE MEMORY" && score >= 10_000_000,
		"Scores exceeding 10 million must be PURE MEMORY.",
		{ score, lamp },
	);

	let potential = 0;

	if (score >= 10_000_000) {
		potential = internalChartLevel + 2;
	} else if (score >= 9_800_000) {
		potential = internalChartLevel + 1 + (score - 9_800_000) / 200_000;
	} else {
		potential = internalChartLevel + (score - 9_500_000) / 300_000;
	}

	if (lamp !== "LOST") {
		potential += 0.2;
	}

	return Math.max(potential, 0);
}
