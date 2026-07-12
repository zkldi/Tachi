import { ONE_DAY } from "#lib/constants/time";
import { InvalidScoreFailure } from "#lib/score-import/framework/common/converter-failures";
import { Testing511SPA, TestingIIDXSPScore } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import { ValidateScore } from "./validate-score";

describe("ValidateScore", () => {
	it("rejects scores in the future", () => {
		expect(() =>
			ValidateScore(
				{ ...TestingIIDXSPScore, timeAchieved: Date.now() + ONE_DAY * 2 },
				Testing511SPA,
			),
		).toThrow(InvalidScoreFailure);

		expect(() =>
			ValidateScore(
				{ ...TestingIIDXSPScore, timeAchieved: Date.now() + ONE_DAY * 2 },
				Testing511SPA,
			),
		).toThrow("Invalid timestamp: score happens in the future.");
	});
});
