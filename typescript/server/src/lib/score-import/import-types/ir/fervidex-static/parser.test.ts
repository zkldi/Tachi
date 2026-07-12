import { log } from "#lib/log/log";
import { FervidexStaticBase } from "#test-utils/test-data";
import { describe, expect, it } from "vitest";

import { ParseFervidexStatic } from "./parser";

describe("ParseFervidexStatic", () => {
	it("parses static score data from the body", () => {
		const res = ParseFervidexStatic(
			FervidexStaticBase,
			{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
			log,
		);

		expect(res.iterable).toEqual([
			{
				song_id: 1000,
				chart: "spa",
				clear_type: 4,
				ex_score: 1180,
				miss_count: 40,
			},
			{
				song_id: 1000,
				chart: "spn",
				clear_type: 7,
				ex_score: 158,
				miss_count: 0,
			},
			{
				song_id: 1001,
				chart: "dph",
				clear_type: 3,
				ex_score: 15,
				miss_count: 1,
			},
		]);

		expect(res).toMatchObject({
			context: { version: "27" },
			gameGroup: "iidx",
		});

		expect(typeof res.classProvider).toBe("function");
	});

	it("returns an empty iterable when shouldImportScores is false", () => {
		const res = ParseFervidexStatic(
			FervidexStaticBase,
			{ model: "LDJ:J:B:A:2020092900", shouldImportScores: false },
			log,
		);

		expect(res.iterable).toEqual([]);

		expect(res).toMatchObject({
			context: { version: "27" },
			gameGroup: "iidx",
		});

		expect(typeof res.classProvider).toBe("function");
	});

	it("requires body.scores", () => {
		expect(() =>
			ParseFervidexStatic(
				{},
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid body\.scores/u);
	});

	it("rejects invalid song ids and score shapes", () => {
		expect(() =>
			ParseFervidexStatic(
				{ scores: { nonsenseKey: {} } },
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid songID nonsenseKey/u);

		expect(() =>
			ParseFervidexStatic(
				{ scores: { 1000: null } },
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid score with songID 1000/u);
	});

	it("rejects missing or invalid per-chart score objects", () => {
		expect(() =>
			ParseFervidexStatic(
				{ scores: { 1000: { spn: null } } },
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid score with songID 1000/u);

		expect(() =>
			ParseFervidexStatic(
				{ scores: { 1000: { spn: undefined } } },
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid score with songID 1000/u);

		expect(() =>
			ParseFervidexStatic(
				{ scores: { 1000: { spn: "foo" } } },
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid score with songID 1000/u);
	});

	it("rejects invalid chart metric values", () => {
		expect(() =>
			ParseFervidexStatic(
				{
					scores: {
						1000: { spn: { ex_score: -1, miss_count: null, clear_type: 0 } },
					},
				},
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid Score with songID 1000 at chart spn/u);

		expect(() =>
			ParseFervidexStatic(
				{
					scores: {
						1000: { spn: { ex_score: 1000, miss_count: "foo", clear_type: 0 } },
					},
				},
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid Score with songID 1000 at chart spn/u);

		expect(() =>
			ParseFervidexStatic(
				{
					scores: {
						1000: { spn: { ex_score: 1000, miss_count: null, clear_type: -1 } },
					},
				},
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid Score with songID 1000 at chart spn/u);
	});

	it("rejects unknown chart keys", () => {
		expect(() =>
			ParseFervidexStatic(
				{
					scores: {
						1000: { spx: { ex_score: 1000, miss_count: null, clear_type: 0 } },
					},
				},
				{ model: "LDJ:J:B:A:2020092900", shouldImportScores: true },
				log,
			),
		).toThrow(/Invalid chart spx/u);
	});
});
