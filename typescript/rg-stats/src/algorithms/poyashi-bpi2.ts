import { BpiV2, type BpiV2Config } from "@bpim/bpicalc";
import { ThrowIf } from "../util/throw-if";
import { integer } from "../util/types";

// these are completely hardcoded, mostly random values that poyashi (or claude) came up with.
export const MODEL_CONSTANTS: BpiV2Config = {
	z0: -0.19383932671707751,
	zRef: 1.9481138704797247,
	z100Median: 6.516395340703802,
	z100Iqr: 1.1916,
	residualRmse: 0.3012,
	coefMedian: 0.949,
	arenaPopulationSize: 4867,
	bpiFloor: -15,
	curveExpClamp: [0.62, 3],
	gammaClamp: [0.3, 3],
	rankBaseSingle: 2616,
	rankCurve: [],
	totalBpiShift: 15,
};

const MODEL = new BpiV2(MODEL_CONSTANTS);

export interface ChartParameters {
	notecount: integer;
	worldRecord: integer | null;
	coefficient: number | null;
	mu: number | null;
	sigma: number | null;
}

function chartFor(parameters: ChartParameters) {
	const { coefficient, mu, notecount, sigma, worldRecord } = parameters;

	ThrowIf.not(Number.isSafeInteger(notecount), "Provided note count was not an integer", {
		notecount,
	});
	ThrowIf.negativeOrZero(notecount, "Provided note count was negative or zero", { notecount });

	const max = notecount * 2;

	ThrowIf(worldRecord === null, "Provided world record was null", { worldRecord: "null" });
	ThrowIf.not(Number.isSafeInteger(worldRecord), "Provided world record was not an integer", {
		worldRecord: String(worldRecord),
	});
	ThrowIf.negativeOrZero(worldRecord!, "Provided world record was negative or zero", {
		worldRecord: String(worldRecord),
	});
	ThrowIf(worldRecord! > max, "Provided world record was greater than MAX", {
		worldRecord: String(worldRecord),
		max,
	});

	if (coefficient !== null) {
		ThrowIf.not(Number.isFinite(coefficient), "Provided coefficient was not finite", {
			coefficient,
		});
		ThrowIf.negativeOrZero(coefficient, "Provided coefficient was negative or zero", {
			coefficient,
		});
	}

	ThrowIf(mu === null, "Provided mu was null", { mu: "null" });
	ThrowIf.not(Number.isFinite(mu), "Provided mu was not finite", { mu: String(mu) });
	ThrowIf(sigma === null, "Provided sigma was null", { sigma: "null" });
	ThrowIf.not(Number.isFinite(sigma), "Provided sigma was not finite", { sigma: String(sigma) });
	ThrowIf.negativeOrZero(sigma!, "Provided sigma was negative or zero", {
		sigma: String(sigma),
	});

	const chart = MODEL.chart({
		notes: notecount,
		kaidenAvg: null,
		wrScore: worldRecord,
		coef: coefficient,
		mu,
		sigma,
	});

	ThrowIf.not(chart.hasParams, "Provided chart parameters produced degenerate BPI V2 anchors", {
		mu: mu!,
		sigma: sigma!,
		worldRecord: worldRecord!,
	});

	return chart;
}

/** Calculates BPI V2 for a score on a chart. */
export function calculate(yourEx: integer, parameters: ChartParameters) {
	const chart = chartFor(parameters);
	const max = parameters.notecount * 2;
	ThrowIf.not(Number.isSafeInteger(yourEx), "Provided EX was not an integer", { yourEx });
	ThrowIf.negative(yourEx, "Provided EX was negative", { yourEx });
	ThrowIf(yourEx > max, "Provided EX was greater than MAX", { yourEx, max });

	return chart.bpi(yourEx)!;
}

/** Returns the minimum EX score necessary to achieve the provided BPI V2 value. */
export function inverse(bpi: number, parameters: ChartParameters) {
	ThrowIf.not(Number.isFinite(bpi), "Provided BPI was not finite", { bpi });
	ThrowIf(bpi < MODEL_CONSTANTS.bpiFloor!, "Provided BPI was below the BPI floor", { bpi });

	return chartFor(parameters).scoreFor(bpi)!;
}
