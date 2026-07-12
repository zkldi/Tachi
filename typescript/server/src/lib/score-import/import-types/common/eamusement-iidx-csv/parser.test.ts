import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { MockMulterFile } from "#test-utils/mock-multer";
import { TestingIIDXEamusementCSV26, TestingIIDXEamusementCSV27 } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import GenericParseEamIIDXCSV, { IIDXCSVParse, ResolveHeaders } from "./parser";

describe("IIDXCSVParse", () => {
	it("parses valid Rootage-style CSV", () => {
		const { iterableData, hasBeginnerAndLegg, version } = IIDXCSVParse(
			TestingIIDXEamusementCSV26,
			"SP",
			log,
		);

		expect(iterableData.length).toBe(456);
		expect(hasBeginnerAndLegg).toBe(false);
		expect(version).toBe("26");
	});

	it("parses valid HV CSV", () => {
		const { iterableData, hasBeginnerAndLegg, version } = IIDXCSVParse(
			TestingIIDXEamusementCSV27,
			"SP",
			log,
		);

		expect(iterableData.length).toBe(6285);
		expect(hasBeginnerAndLegg).toBe(true);
		expect(version).toBe("27");
	});

	it("throws on malformed CSV rows", () => {
		const buffer = Buffer.from(`${"a,".repeat(26)}a\n${"a,".repeat(3)}a`);

		expect(() => IIDXCSVParse(buffer, "SP", log)).toThrow(
			new ScoreImportFatalError(
				400,
				"Row 1 has an invalid amount of cells (4, expected 27).",
			),
		);
	});

	it("infers the highest e-amusement version from rows", () => {
		const headerStr = `${"a,".repeat(26)}a`;

		const row = `GARBAGE VERSION,foo bar,${"a,".repeat(24)}a`;

		const invalidVersions = Buffer.from(`${headerStr}\n${row}`);

		expect(() => IIDXCSVParse(invalidVersions, "SP", log)).toThrow(
			new ScoreImportFatalError(
				400,
				"Invalid/Unsupported Eamusement Version Name GARBAGE VERSION.",
			),
		);

		const row27th = `HEROIC VERSE,foo bar,${"a,".repeat(24)}a`;
		const row17th = `SIRIUS,foo bar,${"a,".repeat(24)}a`;

		let { version } = IIDXCSVParse(
			Buffer.from([headerStr, row27th, row17th].join("\n")),
			"SP",
			log,
		);

		expect(version).toBe("27");

		({ version } = IIDXCSVParse(
			Buffer.from([headerStr, row17th, row27th].join("\n")),
			"SP",
			log,
		));

		expect(version).toBe("27");
	});
});

describe("ResolveHeaders", () => {
	it("detects Rootage-style headers", () => {
		const { hasBeginnerAndLegg } = ResolveHeaders(
			[
				"バージョン",
				"タイトル",
				"ジャンル",
				"アーティスト",
				"プレー回数",
				"NORMAL 難易度",
				"NORMAL EXスコア",
				"NORMAL PGreat",
				"NORMAL Great",
				"NORMAL ミスカウント",
				"NORMAL クリアタイプ",
				"NORMAL DJ LEVEL",
				"HYPER 難易度",
				"HYPER EXスコア",
				"HYPER PGreat",
				"HYPER Great",
				"HYPER ミスカウント",
				"HYPER クリアタイプ",
				"HYPER DJ LEVEL",
				"ANOTHER 難易度",
				"ANOTHER EXスコア",
				"ANOTHER PGreat",
				"ANOTHER Great",
				"ANOTHER ミスカウント",
				"ANOTHER クリアタイプ",
				"ANOTHER DJ LEVEL",
				"最終プレー日時",
			],
			log,
		);

		expect(hasBeginnerAndLegg).toBe(false);
	});

	it("detects HV-style headers", () => {
		const { hasBeginnerAndLegg } = ResolveHeaders(
			[
				"バージョン",
				"タイトル",
				"ジャンル",
				"アーティスト",
				"プレー回数",
				"BEGINNER 難易度",
				"BEGINNER スコア",
				"BEGINNER PGreat",
				"BEGINNER Great",
				"BEGINNER ミスカウント",
				"BEGINNER クリアタイプ",
				"BEGINNER DJ LEVEL",
				"NORMAL 難易度",
				"NORMAL スコア",
				"NORMAL PGreat",
				"NORMAL Great",
				"NORMAL ミスカウント",
				"NORMAL クリアタイプ",
				"NORMAL DJ LEVEL",
				"HYPER 難易度",
				"HYPER スコア",
				"HYPER PGreat",
				"HYPER Great",
				"HYPER ミスカウント",
				"HYPER クリアタイプ",
				"HYPER DJ LEVEL",
				"ANOTHER 難易度",
				"ANOTHER スコア",
				"ANOTHER PGreat",
				"ANOTHER Great",
				"ANOTHER ミスカウント",
				"ANOTHER クリアタイプ",
				"ANOTHER DJ LEVEL",
				"LEGGENDARIA 難易度",
				"LEGGENDARIA スコア",
				"LEGGENDARIA PGreat",
				"LEGGENDARIA Great",
				"LEGGENDARIA ミスカウント",
				"LEGGENDARIA クリアタイプ",
				"LEGGENDARIA DJ LEVEL",
				"最終プレー日時",
			],
			log,
		);

		expect(hasBeginnerAndLegg).toBe(true);
	});

	it("throws when header count is wrong", () => {
		expect(() => ResolveHeaders([], log)).toThrow(
			new ScoreImportFatalError(
				400,
				"Invalid CSV provided. CSV does not have the correct amount of headers.",
			),
		);

		expect(() => ResolveHeaders(Array(1000), log)).toThrow(
			new ScoreImportFatalError(
				400,
				"Invalid CSV provided. CSV does not have the correct amount of headers.",
			),
		);
	});
});

describe("GenericParseEamIIDXCSV", () => {
	it("requires playtype and checks filename safety", () => {
		const validSPFile = MockMulterFile(TestingIIDXEamusementCSV27, "iidx_27_sp.csv");

		expect(() => GenericParseEamIIDXCSV(validSPFile, {}, "e-amusement", log)).toThrow(
			new ScoreImportFatalError(400, "Invalid playtype of undefined given."),
		);

		let { context } = GenericParseEamIIDXCSV(
			validSPFile,
			{ playtype: "SP" },
			"e-amusement",
			log,
		);

		expect(context.playtype).toBe("SP");

		const mockDPFile = MockMulterFile(TestingIIDXEamusementCSV27, "iidx_27_dp.csv");

		({ context } = GenericParseEamIIDXCSV(mockDPFile, { playtype: "DP" }, "e-amusement", log));

		expect(context.playtype).toBe("DP");

		expect(() =>
			GenericParseEamIIDXCSV(validSPFile, { playtype: "DP" }, "e-amusement", log),
		).toThrow(
			new ScoreImportFatalError(
				400,
				"Safety Triggered: Filename contained 'SP', but was marked as a DP import. Are you *absolutely* sure this is right?",
			),
		);

		({ context } = GenericParseEamIIDXCSV(
			mockDPFile,
			{ playtype: "DP", assertPlaytypeCorrect: true },
			"e-amusement",
			log,
		));

		expect(context.playtype).toBe("DP");
	});
});
