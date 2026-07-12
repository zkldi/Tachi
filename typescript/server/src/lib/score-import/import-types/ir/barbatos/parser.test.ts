import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { MockBarbatosScore } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import { ParseBarbatosSingle } from "./parser";

describe("ParseBarbatosSingle", () => {
	it("returns the score as the iterable payload", () => {
		const res = ParseBarbatosSingle(
			MockBarbatosScore as unknown as Record<string, unknown>,
			log,
		);

		expect(res).toMatchObject({
			gameGroup: "sdvx",
			iterable: [MockBarbatosScore],
		});
		expect(res.context).toMatchObject({ version: "vivid" });
		expect(typeof res.context.timeReceived).toBe("number");
	});

	it("rejects invalid scores", () => {
		expect(() => ParseBarbatosSingle({}, log)).toThrow(ScoreImportFatalError);
	});
});
