import type { GamesForGroup } from "../types/game-config";
import type { GetEnumValue } from "../types/metrics";

export interface GradeBoundary<G extends string> {
	name: G;
	lowerBound: number;
}

export function MakeGradeBoundaries<G extends string>(rec: Record<G, number>) {
	const out: Array<GradeBoundary<G>> = [];

	for (const [name, lowerBound] of Object.entries(rec)) {
		// weird casts here?
		out.push({ name: name as G, lowerBound: lowerBound as number });
	}

	// sort ascendingly
	out.sort((a, b) => a.lowerBound - b.lowerBound);

	return out;
}

export type IIDXLikes = GamesForGroup["bms" | "iidx" | "pms"];

/**
 * @note - These are *also* grade boundaries for BMS and PMS.
 *
 * There is a **very** specific reason we do the math as
 * (100 * X) / 9
 * and not 100 * (X / 9)
 * Floating point accuracy is hard, and the latter actually results
 * in awful edge case pains.
 * 100 * (7/9) = 77.77777777777779
 * (100*7) / 9 = 77
 * that said, making grade boundaries into ninths was a sick joke.
 */
export const IIDXLIKE_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<IIDXLikes, "grade">>({
	F: 0,
	E: (100 * 2) / 9,
	D: (100 * 3) / 9,
	C: (100 * 4) / 9,
	B: (100 * 5) / 9,
	A: (100 * 6) / 9,
	AA: (100 * 7) / 9,
	AAA: (100 * 8) / 9,
	"MAX-": (100 * 17) / 18,
	MAX: (100 * 9) / 9,
});

export const CHUNITHM_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"chunithm", "grade">>({
	D: 0,
	C: 500_000,
	B: 600_000,
	BB: 700_000,
	BBB: 800_000,
	A: 900_000,
	AA: 925_000,
	AAA: 950_000,
	S: 975_000,
	"S+": 990_000,
	SS: 1_000_000,
	"SS+": 1_005_000,
	SSS: 1_007_500,
	"SSS+": 1_009_000,
});

export const WACCA_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"wacca", "grade">>({
	D: 0,
	C: 1, // LOL
	B: 300_100,
	A: 700_000,
	AA: 800_000,
	AAA: 850_000,
	S: 900_000,
	"S+": 930_000,
	SS: 950_000,
	"SS+": 970_000,
	SSS: 980_000,
	"SSS+": 990_000,
	MASTER: 1_000_000,
});

export const JUBEAT_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"jubeat", "grade">>({
	E: 0,
	D: 500_000,
	C: 700_000,
	B: 800_000,
	A: 850_000,
	S: 900_000,
	SS: 950_000,
	SSS: 980_000,
	EXC: 1_000_000,
});

export const ITG_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"itg-stamina", "grade">>({
	// cannot be achieved. This can only be attained if the player failed the chart.
	F: -Infinity,
	D: 0, // The lowest score you can get in ITG is -400%. Scores "can" go negative.
	// but we don't support it haha lol

	C: 55,
	B: 68,
	A: 80,
	S: 89,
	"★": 96,
	"★★": 98,
	"★★★": 99,
	"★★★★": 100,
});

export const GITADORA_GBOUNDARIES = MakeGradeBoundaries<
	GetEnumValue<"gitadora-dora" | "gitadora-gita", "grade">
>({
	C: 0,
	B: 63,
	A: 73,
	S: 80,
	SS: 95,
	MAX: 100,
});

export const MUSECA_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"museca", "grade">>({
	没: 0,
	拙: 600_000,
	凡: 700_000,
	佳: 800_000,
	良: 850_000,
	優: 900_000,
	秀: 950_000,
	傑: 975_000,
	傑G: 1_000_000,
});

/**
 * @note - The SSS+ rank boundary is chart-dependent - it is the maximum percent of a chart.
 * 104 is just the upper limit of the maximum percent.
 */
export const MAIMAI_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"maimai", "grade">>({
	F: 0,
	E: 10,
	D: 20,
	C: 40,
	B: 60,
	A: 80,
	AA: 90,
	AAA: 94,
	S: 97,
	"S+": 98,
	SS: 99,
	"SS+": 99.5,
	SSS: 100,
	// The actual SSS+ boundary is chart-dependent!
	"SSS+": 104,
});

export const MAIMAIDX_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"maimaidx", "grade">>({
	D: 0,
	C: 50,
	B: 60,
	BB: 70,
	BBB: 75,
	A: 80,
	AA: 90,
	AAA: 94,
	S: 97,
	"S+": 98,
	SS: 99,
	"SS+": 99.5,
	SSS: 100,
	"SSS+": 100.5,
});

export const POPN_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"popn", "grade">>({
	E: 0,
	D: 50_000,
	C: 62_000,
	B: 72_000,
	A: 82_000,
	AA: 90_000,
	AAA: 95_000,
	S: 98_000,
});

type SDVXLikes = GamesForGroup["sdvx" | "usc"];

export const SDVXLIKE_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<SDVXLikes, "grade">>({
	D: 0,
	C: 7_000_000,
	B: 8_000_000,
	A: 8_700_000,
	"A+": 9_000_000,
	AA: 9_300_000,
	"AA+": 9_500_000,
	AAA: 9_700_000,
	"AAA+": 9_800_000,
	S: 9_900_000,
	PUC: 10_000_000,
});

export const ARCAEA_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"arcaea", "grade">>({
	D: 0,
	C: 8_600_000,
	B: 8_900_000,
	A: 9_200_000,
	AA: 9_500_000,
	EX: 9_800_000,
	"EX+": 9_900_000,
});

export const ONGEKI_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"ongeki", "grade">>({
	D: 0,
	C: 500_000,
	B: 700_000,
	BB: 750_000,
	BBB: 800_000,
	A: 850_000,
	AA: 900_000,
	AAA: 940_000,
	S: 970_000,
	SS: 990_000,
	SSS: 1_000_000,
	"SSS+": 1_007_500,
});

export const DDR_GBOUNDARIES = MakeGradeBoundaries<GetEnumValue<"ddr-dp" | "ddr-sp", "grade">>({
	AAA: 990000,
	"AA+": 950000,
	AA: 900000,
	"AA-": 890000,
	"A+": 850000,
	A: 800000,
	"A-": 790000,
	"B+": 750000,
	B: 700000,
	"B-": 690000,
	"C+": 650000,
	C: 600000,
	"C-": 590000,
	"D+": 550000,
	D: 0,
	// cannot be achieved. This can only be attained if the player failed the chart.
	E: -Infinity,
});
