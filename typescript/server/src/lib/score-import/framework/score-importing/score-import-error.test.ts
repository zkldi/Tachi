import { describe, expect, it } from "vitest";

import ScoreImportFatalError from "./score-import-error";

describe("ScoreImportFatalError", () => {
	it("stores status code and message", () => {
		const err = new ScoreImportFatalError(500, "error message");

		expect(err.statusCode).toBe(500);
		expect(err.message).toBe("error message");
	});
});
