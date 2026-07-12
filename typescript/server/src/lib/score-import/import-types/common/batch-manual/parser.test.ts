import type { BatchManual } from "tachi-common";

import { log } from "#lib/log/log";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import { EscapeStringRegexp } from "#utils/misc";
import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

import { ParseBatchManualFromObject as ParserFn } from "./parser";

const mockErr = (...msg: Array<string>) =>
	new RegExp(msg.map((e) => `${EscapeStringRegexp(e)}.*`).join(""), "u");

function expectThrowsFatal(fn: () => void, expected: ScoreImportFatalError) {
	try {
		fn();
		expect.fail("expected ScoreImportFatalError");
	} catch (e) {
		expect(e).toBeInstanceOf(ScoreImportFatalError);
		expect((e as ScoreImportFatalError).statusCode).toBe(expected.statusCode);
		expect((e as ScoreImportFatalError).message).toBe(expected.message);
	}
}

function expectThrowsFatalMatch(fn: () => void, pattern: RegExp) {
	try {
		fn();
		expect.fail("expected ScoreImportFatalError");
	} catch (e) {
		expect(e).toBeInstanceOf(ScoreImportFatalError);
		expect((e as ScoreImportFatalError).message).toMatch(pattern);
	}
}

const baseBatchManual = {
	scores: [],
	meta: { service: "foo", game: "iidx", playtype: "SP" },
};

const baseBatchManualScore = {
	score: 1000,
	lamp: "HARD CLEAR",
	matchType: "tachiSongID",
	identifier: "123",
	difficulty: "ANOTHER",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dm(sc: any) {
	return deepmerge(
		baseBatchManual,
		{ scores: [deepmerge(baseBatchManualScore, sc)] },
		{ arrayMerge: (r, c) => c },
	);
}

const baseBatchManualV3 = {
	scores: [],
	meta: { service: "foo", game: "iidx-sp" as const },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dmV3(sc: any) {
	return deepmerge(
		baseBatchManualV3,
		{ scores: [deepmerge(baseBatchManualScore, sc)] },
		{ arrayMerge: (r, c) => c },
	);
}

describe("#ParserFn", () => {
	it("Non-Object", () => {
		expectThrowsFatal(
			() => ParserFn(false as unknown as BatchManual, "file/batch-manual", false, log),
			new ScoreImportFatalError(
				400,
				"Invalid BATCH-MANUAL (Not an object, received boolean.)",
			),
		);
	});

	it("No Header", () => {
		expectThrowsFatal(
			() =>
				ParserFn({ scores: [] } as unknown as BatchManual, "file/batch-manual", false, log),
			new ScoreImportFatalError(
				400,
				"Could not retrieve meta.game - is this valid BATCH-MANUAL?",
			),
		);
	});

	it("No Game", () => {
		expectThrowsFatal(
			() =>
				ParserFn(
					{
						scores: [],
						meta: { service: "foo", playtype: "SP" },
					} as unknown as BatchManual,
					"file/batch-manual",
					false,
					log,
				),
			new ScoreImportFatalError(
				400,
				"Could not retrieve meta.game - is this valid BATCH-MANUAL?",
			),
		);
	});

	it("No Playtype - game group without playtype is not a V3 game", () => {
		expectThrowsFatalMatch(
			() =>
				ParserFn(
					{
						scores: [],
						meta: { service: "foo", game: "iidx" },
					} as unknown as BatchManual,
					"file/batch-manual",
					false,
					log,
				),
			mockErr("Invalid game 'iidx'. It must be one of"),
		);
	});

	it("Invalid Game", () => {
		expect(() =>
			ParserFn(
				{ scores: [], meta: { service: "foo", game: "invalid_game", playtype: "SP" } },
				"file/batch-manual",
				false,
				log,
			),
		).toThrow(ScoreImportFatalError);

		expect(() =>
			ParserFn(
				{
					scores: [],
					meta: { service: "foo", game: 123, playtype: "SP" },
				} as unknown as BatchManual,
				"file/batch-manual",
				false,
				log,
			),
		).toThrow(ScoreImportFatalError);
	});

	it("Invalid Service", () => {
		expectThrowsFatalMatch(
			() =>
				ParserFn(
					{ scores: [], meta: { service: "1", game: "iidx", playtype: "SP" } },
					"file/batch-manual",
					false,
					log,
				),
			/^Invalid BATCH-MANUAL: meta/u,
		);

		expectThrowsFatalMatch(
			() =>
				ParserFn(
					{
						scores: [],
						meta: { service: 1, game: "iidx", playtype: "SP" },
					} as unknown as BatchManual,
					"file/batch-manual",
					false,
					log,
				),
			/^Invalid BATCH-MANUAL: meta/u,
		);
	});

	it("Valid Empty BATCH-MANUAL", () => {
		const res = ParserFn(
			{ scores: [], meta: { service: "foo", game: "iidx", playtype: "SP" } },
			"file/batch-manual",
			false,
			log,
		);

		expect(res).toMatchObject({
			gameGroup: "iidx",
			context: {
				service: "foo",
				game: "iidx-sp",
				version: null,
			},
			iterable: [],
		});
	});

	it("Valid Empty BATCH-MANUAL with v3 meta.game only (no playtype)", () => {
		const res = ParserFn(
			{ scores: [], meta: { service: "foo", game: "iidx-sp" } },
			"file/batch-manual",
			false,
			log,
		);

		expect(res).toMatchObject({
			gameGroup: "iidx",
			context: {
				service: "foo",
				game: "iidx-sp",
				version: null,
			},
			iterable: [],
		});
	});

	it("meta.playtype forces legacy interpretation of meta.game (reject bare V3 string)", () => {
		expectThrowsFatalMatch(
			() =>
				ParserFn(
					{
						scores: [],
						meta: { service: "foo", game: "iidx-sp", playtype: "SP" },
					} as unknown as BatchManual,
					"file/batch-manual",
					false,
					log,
				),
			mockErr("Invalid game group"),
		);
	});

	describe("Valid BATCH-MANUAL", () => {
		it("Basic BATCH-MANUAL with v3 meta.game only", () => {
			const res = ParserFn(dmV3({}), "file/batch-manual", false, log);

			expect(res).toMatchObject({
				gameGroup: "iidx",
				context: {
					service: "foo",
					game: "iidx-sp",
					version: null,
				},
				iterable: [
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "tachiSongID",
						identifier: "123",
						difficulty: "ANOTHER",
					},
				],
			});
		});

		it("Basic BATCH-MANUAL", () => {
			const res = ParserFn(
				{
					scores: [
						{
							score: 1000,
							lamp: "HARD CLEAR",
							matchType: "tachiSongID",
							identifier: "123",
							difficulty: "ANOTHER",
						},
						{
							score: 1000,
							lamp: "HARD CLEAR",
							matchType: "tachiSongID",
							identifier: "123",
							difficulty: "HYPER",
						},
						{
							score: 1000,
							lamp: "HARD CLEAR",
							matchType: "songTitle",
							identifier: "5.1.1.",
						},
						{
							score: 1000,
							lamp: "HARD CLEAR",
							matchType: "songTitle",
							identifier: "5.1.1.",
						},
					],
					meta: { service: "foo", game: "iidx", playtype: "SP" },
				} as BatchManual,
				"file/batch-manual",
				false,
				log,
			);

			expect(res).toMatchObject({
				gameGroup: "iidx",
				context: {
					service: "foo",
					game: "iidx-sp",
					version: null,
				},
				iterable: [
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "tachiSongID",
						identifier: "123",
						difficulty: "ANOTHER",
					},
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "tachiSongID",
						identifier: "123",
						difficulty: "HYPER",
					},
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "songTitle",
						identifier: "5.1.1.",
					},
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "songTitle",
						identifier: "5.1.1.",
					},
				],
			});
		});

		it("Valid Optional", () => {
			const res = ParserFn(
				dm({ optional: { bp: 10, gauge: 100, gaugeHistory: null, comboBreak: 7 } }),
				"file/batch-manual",
				false,
				log,
			);

			expect(res).toMatchObject({
				gameGroup: "iidx",
				context: {
					service: "foo",
					game: "iidx-sp",
					version: null,
				},
				iterable: [
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "tachiSongID",
						identifier: "123",
						difficulty: "ANOTHER",
						optional: {
							bp: 10,
							gauge: 100,
							gaugeHistory: null,
							comboBreak: 7,
						},
					},
				],
			});
		});

		it("Valid judgements", () => {
			const res = ParserFn(
				dm({ judgements: { pgreat: 1, great: null, bad: 0 } }),
				"file/batch-manual",
				false,
				log,
			);

			expect(res).toMatchObject({
				gameGroup: "iidx",
				context: {
					service: "foo",
					game: "iidx-sp",
					version: null,
				},
				iterable: [
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "tachiSongID",
						identifier: "123",
						difficulty: "ANOTHER",
						judgements: {
							pgreat: 1,
							great: null,
							bad: 0,
						},
					},
				],
			});
		});

		it("With class", () => {
			const res = ParserFn(
				{
					meta: baseBatchManual.meta,
					scores: [baseBatchManualScore],
					classes: { dan: "KAIDEN" },
				} as BatchManual,
				"file/batch-manual",
				false,
				log,
			);

			expect(res.classProvider).not.toBeNull();

			expect(res.classProvider!("iidx-sp", 1, {}, log)).toStrictEqual({ dan: "KAIDEN" });
			expect(res.classProvider!("iidx-dp", 1, {}, log)).toStrictEqual({});
		});

		it("With class set to null.", () => {
			const res = ParserFn(
				{
					meta: baseBatchManual.meta,
					scores: [baseBatchManualScore],
					classes: null,
				} as BatchManual,
				"file/batch-manual",
				false,
				log,
			);

			expect(res.classProvider).toBeNull();
		});
	});

	describe("Invalid BATCH-MANUAL", () => {
		it("Invalid Lamp For Game", () => {
			const fn = () =>
				ParserFn(
					{
						scores: [
							{
								score: 1000,

								// not an iidx lamp
								lamp: "ALL JUSTICE",
								matchType: "tachiSongID",
								identifier: "123",
								difficulty: "ANOTHER",
							},
						],
						meta: { service: "foo", game: "iidx", playtype: "SP" },
					},
					"file/batch-manual",
					false,
					log,
				);

			expectThrowsFatal(
				fn,
				new ScoreImportFatalError(
					400,
					"Invalid BATCH-MANUAL: scores[0].lamp | Expected any of NO PLAY, FAILED, ASSIST CLEAR, EASY CLEAR, CLEAR, HARD CLEAR, EX HARD CLEAR, FULL COMBO. | Received ALL JUSTICE [type: string].",
				),
			);
		});

		it("Non-numeric score", () => {
			const fn = () => ParserFn(dm({ score: "123" }), "file/batch-manual", false, log);

			expectThrowsFatal(
				fn,
				new ScoreImportFatalError(
					400,
					"Invalid BATCH-MANUAL: scores[0].score | Expected an integer. | Received 123 [type: string].",
				),
			);
		});

		it("Invalid timeAchieved", () => {
			const fn = () =>
				ParserFn(dm({ timeAchieved: "string" }), "file/batch-manual", false, log);

			expectThrowsFatal(
				fn,
				new ScoreImportFatalError(
					400,
					"Invalid BATCH-MANUAL: scores[0].timeAchieved | Expected a number greater than 1 Trillion - did you pass unix seconds instead of milliseconds? | Received string [type: string].",
				),
			);

			const fn2 = () =>
				ParserFn(
					dm({ timeAchieved: 1_620_768_609_637 / 1000 }),
					"file/batch-manual",
					false,
					log,
				);

			expectThrowsFatal(
				fn2,
				new ScoreImportFatalError(
					400,
					"Invalid BATCH-MANUAL: scores[0].timeAchieved | Expected a number greater than 1 Trillion - did you pass unix seconds instead of milliseconds? | Received 1620768609.637 [type: number].",
				),
			);
		});

		it("TimeAchieved of 0 should be legal.", () => {
			const res = ParserFn(dm({ timeAchieved: 0 }), "file/batch-manual", false, log);

			expect(res).toMatchObject({
				gameGroup: "iidx",
				context: {
					service: "foo",
					game: "iidx-sp",
					version: null,
				},
				iterable: [
					{
						score: 1000,
						lamp: "HARD CLEAR",
						matchType: "tachiSongID",
						identifier: "123",
						difficulty: "ANOTHER",
						timeAchieved: 0,
					},
				],
			});
		});

		it("Invalid Identifier", () => {
			const fn = () => ParserFn(dm({ identifier: null }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(
				fn,
				mockErr("scores[0].identifier | Expected string", "Received null [type: null]"),
			);
		});

		it("Invalid MatchType", () => {
			const fn = () =>
				ParserFn(dm({ matchType: "Invalid_MatchType" }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(
				fn,
				mockErr(
					"scores[0].matchType | Expected any of",
					"Received Invalid_MatchType [type: string]",
				),
			);
		});

		it("Invalid judgements", () => {
			const fn = () =>
				ParserFn(dm({ judgements: { not_key: 123 } }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(fn, mockErr("scores[0].judgements | Invalid Key not_key"));

			const fn2 = () =>
				ParserFn(dm({ judgements: { pgreat: "123" } }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(
				fn2,
				mockErr(
					"scores[0].judgements | Key pgreat had an invalid value of 123 [type: string]",
				),
			);
		});

		it("Invalid optional", () => {
			const fn = () =>
				ParserFn(dm({ hitMeta: { not_key: 123 } }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(fn, mockErr("scores[0].hitMeta | Unexpected"));

			const fn2 = () =>
				ParserFn(dm({ hitMeta: { bp: -1 } }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(fn2, mockErr("scores[0].hitMeta.bp"));

			const fn3 = () =>
				ParserFn(dm({ optional: { not_key: 123 } }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(fn3, mockErr("scores[0].optional | Unexpected"));

			const fn4 = () =>
				ParserFn(dm({ optional: { bp: -1 } }), "file/batch-manual", false, log);

			expectThrowsFatalMatch(fn4, mockErr("scores[0].optional.bp"));
		});

		describe("Invalid class", () => {
			it("Should throw if class is out of bounds.", () => {
				expectThrowsFatalMatch(
					() =>
						ParserFn(
							{
								meta: baseBatchManual.meta,
								scores: [baseBatchManualScore],
								classes: { dan: "UNKNOWN" },
							} as BatchManual,
							"file/batch-manual",
							false,
							log,
						),
					mockErr(
						"Invalid BATCH-MANUAL: classes.dan | Expected any of KYU_7, KYU_6, KYU_5, KYU_4, KYU_3, KYU_2, KYU_1, DAN_1, DAN_2, DAN_3, DAN_4, DAN_5, DAN_6, DAN_7, DAN_8, DAN_9, DAN_10, CHUUDEN, KAIDEN. | Received UNKNOWN [type: string]",
					),
				);
			});

			it("Should throw if dans for different games are passed.", () => {
				expectThrowsFatalMatch(
					() =>
						ParserFn(
							{
								meta: baseBatchManual.meta,
								scores: [baseBatchManualScore],
								classes: { stageUp: "XII" },
							} as BatchManual,
							"file/batch-manual",
							false,
							log,
						),
					mockErr("classes | Unexpected properties inside object: stageUp"),
				);
			});

			it("Should throw if dan is a non-string.", () => {
				expectThrowsFatalMatch(
					() =>
						ParserFn(
							{
								meta: baseBatchManual.meta,
								scores: [baseBatchManualScore],
								classes: { dan: 9 },
							} as unknown as BatchManual,
							"file/batch-manual",
							false,
							log,
						),
					mockErr(
						"Invalid BATCH-MANUAL: classes.dan | Expected any of KYU_7, KYU_6, KYU_5, KYU_4, KYU_3, KYU_2, KYU_1, DAN_1, DAN_2, DAN_3, DAN_4, DAN_5, DAN_6, DAN_7, DAN_8, DAN_9, DAN_10, CHUUDEN, KAIDEN. | Received 9 [type: number].",
					),
				);
			});

			it("Should throw if unknown classes are present.", () => {
				expectThrowsFatalMatch(
					() =>
						ParserFn(
							{
								meta: baseBatchManual.meta,
								scores: [baseBatchManualScore],
								classes: { dan: "DAN_9", unknownDan: "FIRST" },
							} as unknown as BatchManual,
							"file/batch-manual",
							false,
							log,
						),
					mockErr("classes | Unexpected properties inside object: unknownDan."),
				);

				expectThrowsFatalMatch(
					() =>
						ParserFn(
							{
								meta: baseBatchManual.meta,
								scores: [baseBatchManualScore],
								classes: { dan: "KAIDEN", stageUp: "XII" },
							} as unknown as BatchManual,
							"file/batch-manual",
							false,
							log,
						),
					mockErr(
						"Invalid BATCH-MANUAL: classes | Unexpected properties inside object: stageUp.",
					),
				);
			});
		});
	});
});
