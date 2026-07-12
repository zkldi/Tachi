import { dmf } from "#test-utils/misc";
import {
	Testing511SPA,
	TestingIIDXSPDryScore,
	TestingSDVXSingleDryScore,
} from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import type { DryScoreData } from "../common/types";

import { CreateScoreID } from "./score-id";

describe("CreateScoreID", () => {
	it("returns a T-prefixed 40-hex score id", () => {
		const scoreID = CreateScoreID(
			"iidx-sp",
			1,
			TestingIIDXSPDryScore,
			Testing511SPA.legacyChartID,
		);

		expect(scoreID).toMatch(/^T[0-9a-f]{40}/u);
	});

	it("varies with user id", () => {
		const a = CreateScoreID("iidx-sp", 1, TestingIIDXSPDryScore, Testing511SPA.legacyChartID);
		const b = CreateScoreID("iidx-sp", 2, TestingIIDXSPDryScore, Testing511SPA.legacyChartID);

		expect(a).not.toBe(b);
	});

	it("is stable for the same inputs", () => {
		const scoreID = CreateScoreID(
			"iidx-sp",
			1,
			TestingIIDXSPDryScore,
			Testing511SPA.legacyChartID,
		);

		expect(scoreID).toBe(
			CreateScoreID("iidx-sp", 1, TestingIIDXSPDryScore, Testing511SPA.legacyChartID),
		);
	});

	it("only incorporates score metrics that affect the checksum", () => {
		const scoreID = CreateScoreID(
			"iidx-sp",
			1,
			TestingIIDXSPDryScore,
			Testing511SPA.legacyChartID,
		);

		expect(scoreID).toBe(
			CreateScoreID(
				"iidx-sp",
				1,
				dmf(TestingIIDXSPDryScore, {
					scoreData: {
						optional: {
							bp: 293,
						},
						judgements: {
							bad: 129,
						},
					} as DryScoreData<"iidx-sp">,
				}),
				Testing511SPA.legacyChartID,
			),
		);
	});

	it("changes when a provided metric changes", () => {
		const scoreID = CreateScoreID(
			"iidx-sp",
			1,
			TestingIIDXSPDryScore,
			Testing511SPA.legacyChartID,
		);

		expect(scoreID).not.toBe(
			CreateScoreID(
				"iidx-sp",
				1,
				dmf(TestingIIDXSPDryScore, {
					scoreData: {
						score: 0,
					} as DryScoreData<"iidx-sp">,
				}),
				Testing511SPA.legacyChartID,
			),
		);
	});

	it("incorporates optional metrics that are part of the score id", () => {
		const sdvxScoreID = CreateScoreID(
			"sdvx",
			1,
			TestingSDVXSingleDryScore,
			Testing511SPA.legacyChartID,
		);

		expect(sdvxScoreID).not.toBe(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: 1 } },
				}),
				Testing511SPA.legacyChartID,
			),
		);

		expect(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: 1 } },
				}),
				Testing511SPA.legacyChartID,
			),
		).not.toBe(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: 100 } },
				}),
				Testing511SPA.legacyChartID,
			),
		);
	});

	it("ignores optional metrics that are not part of the score id", () => {
		expect(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: 1, fast: 18 } },
				}),
				Testing511SPA.legacyChartID,
			),
		).toBe(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: 1 } },
				}),
				Testing511SPA.legacyChartID,
			),
		);
	});

	it("treats null and undefined the same for optional metrics in the score id", () => {
		expect(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: undefined } },
				}),
				Testing511SPA.legacyChartID,
			),
		).toBe(
			CreateScoreID(
				"sdvx",
				1,
				dmf(TestingSDVXSingleDryScore, {
					scoreData: { optional: { exScore: null } },
				}),
				Testing511SPA.legacyChartID,
			),
		);
	});

	it("is deterministic (canary - changing the algorithm is a breaking change)", () => {
		const scoreID = CreateScoreID(
			"iidx-sp",
			1,
			TestingIIDXSPDryScore,
			Testing511SPA.legacyChartID,
		);

		expect(scoreID).toBe("T5d669c4d5d6ca80761e87698acd77c51d2bed95b64ab76e65952dbca7c26bc81");
	});

	it("throws when legacyChartID is not exactly 40 characters", () => {
		expect(() =>
			CreateScoreID("iidx-sp", 1, TestingIIDXSPDryScore, "not-a-legacy-chart-id"),
		).toThrow(/legacyChartID must be exactly 40 characters/u);
	});
});
