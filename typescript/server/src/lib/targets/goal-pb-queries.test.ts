import { GetGameConfig, GetScoreMetricConf, type PBScoreDocument, SDVX_LAMPS } from "tachi-common";
import { describe, expect, it } from "vitest";

import { pbMeetsGoalThreshold } from "./goal-pb-queries";

const sdvxLampConf = GetScoreMetricConf(GetGameConfig("sdvx"), "lamp")!;

function sdvxPb(lamp: number): PBScoreDocument {
	return {
		scoreData: {
			enumIndexes: { lamp },
		},
	} as unknown as PBScoreDocument;
}

describe("pbMeetsGoalThreshold (SDVX lamp / MAXXIVE index shift)", () => {
	it("maps MAXXIVE to index 3 and UC to index 4", () => {
		expect(SDVX_LAMPS.MAXXIVE_CLEAR).toBe(3);
		expect(SDVX_LAMPS.ULTIMATE_CHAIN).toBe(4);
	});

	it("threshold 3 accepts MAXXIVE but not EXCESSIVE CLEAR", () => {
		expect(
			pbMeetsGoalThreshold(sdvxPb(SDVX_LAMPS.MAXXIVE_CLEAR), "lamp", 3, sdvxLampConf),
		).toBe(true);
		expect(
			pbMeetsGoalThreshold(sdvxPb(SDVX_LAMPS.EXCESSIVE_CLEAR), "lamp", 3, sdvxLampConf),
		).toBe(false);
	});

	it("threshold 4 accepts UC but not MAXXIVE (fixed UC quest goals)", () => {
		expect(
			pbMeetsGoalThreshold(sdvxPb(SDVX_LAMPS.ULTIMATE_CHAIN), "lamp", 4, sdvxLampConf),
		).toBe(true);
		expect(
			pbMeetsGoalThreshold(sdvxPb(SDVX_LAMPS.MAXXIVE_CLEAR), "lamp", 4, sdvxLampConf),
		).toBe(false);
	});
});
