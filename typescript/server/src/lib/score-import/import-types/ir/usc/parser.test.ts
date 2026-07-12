import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { TestingUSCChart, uscScore } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import { ParseIRUSC } from "./parser";

describe("ParseIRUSC", () => {
	it("validates and wraps a score in an iterable", () => {
		const res = ParseIRUSC(
			{ score: uscScore } as unknown as Record<string, unknown>,
			TestingUSCChart.data.hashSHA1 as string,
			"Keyboard",
			log,
		);

		expect(res).toMatchObject({
			gameGroup: "usc",
			context: {
				chartHash: TestingUSCChart.data.hashSHA1,
				playtype: "Keyboard",
			},
			iterable: [uscScore],
		});
		expect(typeof res.context.timeReceived).toBe("number");
	});

	it("rejects empty bodies", () => {
		expect(() =>
			ParseIRUSC({}, TestingUSCChart.data.hashSHA1 as string, "Keyboard", log),
		).toThrow(ScoreImportFatalError);

		expect(() =>
			ParseIRUSC({}, TestingUSCChart.data.hashSHA1 as string, "Keyboard", log),
		).toThrow(/Invalid USC Score/iu);
	});
});
