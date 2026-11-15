import { PoyashiBPI2 } from "rg-stats";
import { type ChartDocument, IIDX_GRADES } from "tachi-common";

import { CreateRatingSys } from "./_util";

function AAATier(chart: ChartDocument<"iidx-sp">): number | null {
	const { notecount, worldRecord, bpiCoefficient, bpi2Mu, bpi2Sigma } = chart.data;

	if (worldRecord === null || bpi2Mu === null || bpi2Sigma === null) {
		return null;
	}

	try {
		const bpi = PoyashiBPI2.calculate(Math.ceil((notecount * 2 * 8) / 9), {
			notecount,
			worldRecord,
			coefficient: bpiCoefficient,
			mu: bpi2Mu,
			sigma: bpi2Sigma,
		});

		return Number.isFinite(bpi) ? Math.floor(bpi) : null;
	} catch {
		return null;
	}
}

export const IIDX_AAA_DIFFICULTY = CreateRatingSys<"iidx-sp">(
	"AAA Difficulty",
	"AAA difficulty by BPI V2, grouped by floor(BPI) at the minimum AAA EX score.",
	"grade",
	AAATier,
	(chart) => {
		const tier = AAATier(chart);
		return tier === null ? null : `AAA.${tier}`;
	},
	() => false,
	(score) => [score.scoreData.grade, score.scoreData.enumIndexes.grade >= IIDX_GRADES.AAA],
);
