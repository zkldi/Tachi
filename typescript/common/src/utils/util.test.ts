import { describe, expect, it } from "vitest";

import { IIDXLIKE_GBOUNDARIES, WACCA_GBOUNDARIES } from "../constants/grade-boundaries";
import { GetGradeDeltas } from "./util";

describe("#GetGradeDeltas", () => {
	it("Should correctly calculate grade boundaries.", () => {
		expect(GetGradeDeltas(WACCA_GBOUNDARIES, "S", 921_013)).toStrictEqual({
			lower: "S+21K",
			upper: "(S+)-9K",
			closer: "upper",
		});
	});

	it("Should correctly calculate grade boundaries when score is near lower bound.", () => {
		expect(GetGradeDeltas(WACCA_GBOUNDARIES, "S", 901_013)).toStrictEqual({
			lower: "S+1K",
			upper: "(S+)-29K",
			closer: "lower",
		});
	});

	it("Should apply the num format function.", () => {
		expect(GetGradeDeltas(WACCA_GBOUNDARIES, "S", 901_013, (n) => n.toString())).toStrictEqual({
			lower: "S+1013",
			upper: "(S+)-28987",
			closer: "lower",
		});
	});

	it("i hate iidx", () => {
		expect(
			GetGradeDeltas(IIDXLIKE_GBOUNDARIES, "MAX-", 99.47, (deltaPercent) => {
				const max = 2090;

				const v = (deltaPercent / 100) * max;

				return Math.round(v).toFixed(0);
			}),
		).toStrictEqual({
			lower: "(MAX-)+105",
			upper: "MAX-11",
			closer: "upper",
		});
	});
});
