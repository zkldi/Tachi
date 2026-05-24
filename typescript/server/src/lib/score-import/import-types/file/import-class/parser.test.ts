import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { describe, expect, it } from "vitest";

import ParseImportClass from "./parser";

describe("ParseImportClass", () => {
	it("returns an empty iterable with a class provider", () => {
		const res = ParseImportClass(1, "iidx-sp", { dan: "CHUUDEN" }, log);

		expect(res.iterable).toEqual([]);
		expect(res.service).toBe("Manual Class Import");
		expect(res.gameGroup).toBe("iidx");
		expect(res.classProvider).not.toBeNull();
	});

	it("rejects derived class sets", () => {
		expect(() => ParseImportClass(1, "sdvx", { vfClass: "DANDELION_I" }, log)).toThrow(
			ScoreImportFatalError,
		);
	});

	it("rejects empty class objects", () => {
		expect(() => ParseImportClass(1, "iidx-sp", {}, log)).toThrow(ScoreImportFatalError);
	});
});
