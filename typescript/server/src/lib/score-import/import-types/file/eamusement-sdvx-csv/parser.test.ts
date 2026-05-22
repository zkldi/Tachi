import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { MockMulterFile } from "#test-utils/mock-multer";
import { TestingSDVXEamusementCSV } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import type { SDVXEamusementCSVData } from "./types";

import ParseEamusementSDVXCSV from "./parser";

describe("ParseEamusementSDVXCSV", () => {
	it("parses the fixture CSV", () => {
		const file = MockMulterFile(TestingSDVXEamusementCSV, "score.csv");

		const { iterable, gameGroup } = ParseEamusementSDVXCSV(file, {}, log);

		expect(gameGroup).toBe("sdvx");

		const iterableData = iterable as Array<SDVXEamusementCSVData>;

		expect(iterableData.length).toBe(204);
	});

	it("normalises Unicode space separators in song titles to ASCII space", () => {
		// e-amusement CSV exports use U+00A0 (non-breaking space) in song titles
		// instead of regular spaces, causing title lookups to silently fail.
		const header =
			"楽曲名,難易度,楽曲レベル,クリアランク,スコアグレード,ハイスコア,EXスコア,プレー回数,クリア回数,ULTIMATE CHAIN,PERFECT";
		const nbspTitle = "snow\u00A0storm\u00A0-euphoria-";
		const row = `${nbspTitle},EXHAUST,17.5,EXCESSIVE COMPLETE,AAA+,9821428,6635,5,2,0,0`;
		const buffer = Buffer.from(`${header}\n${row}`);

		const file = MockMulterFile(buffer, "score.csv");

		const { iterable } = ParseEamusementSDVXCSV(file, {}, log);
		const [entry] = iterable as Array<SDVXEamusementCSVData>;

		expect(entry!.title).toBe("snow storm -euphoria-");
	});

	it("rejects rows with wrong cell counts", () => {
		const buffer = Buffer.from(`${"a,".repeat(10)}a\n${"a,".repeat(3)}a`);

		const file = MockMulterFile(buffer, "score.csv");

		expect(() => ParseEamusementSDVXCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseEamusementSDVXCSV(file, {}, log)).toThrow(
			"Row 1 has an invalid amount of cells (4, expected 11)",
		);
	});

	it("rejects CSV with wrong header count", () => {
		const buffer = Buffer.from(`${"a,".repeat(15)}a\n`.repeat(3));

		const file = MockMulterFile(buffer, "score.csv");

		expect(() => ParseEamusementSDVXCSV(file, {}, log)).toThrow(ScoreImportFatalError);
		expect(() => ParseEamusementSDVXCSV(file, {}, log)).toThrow(
			"Invalid CSV provided. CSV does not have the correct number of headers.",
		);
	});
});
