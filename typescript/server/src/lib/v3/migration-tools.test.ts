import { type PgScoreData, type ScoreData, SDVX_GRADES, SDVX_LAMPS } from "tachi-common";
import { describe, expect, it } from "vitest";

import { mongoScoreDataToPg, pgScoreDataToAPI } from "./migration-tools";

const sdvxScoreData: ScoreData<"sdvx"> = {
	score: 9_876_543,
	lamp: "EXCESSIVE CLEAR",
	grade: "S",
	optional: {
		enumIndexes: {},
		exScore: 123,
		fast: 32,
		gauge: 99,
		maxCombo: 9,
		slow: 42,
	},
	enumIndexes: {
		grade: SDVX_GRADES.S,
		lamp: SDVX_LAMPS.EXCESSIVE_CLEAR,
	},
	judgements: {
		critical: 123,
		miss: 23,
		near: 22,
	},
};

const pgSdvxScoreData: PgScoreData<"sdvx"> = {
	data: {
		exScore: 123,
		fast: 32,
		gauge: 99,
		maxCombo: 9,
		slow: 42,
		score: 9_976_543,
		lamp: SDVX_LAMPS.EXCESSIVE_CLEAR,
	},
	derived: {
		grade: SDVX_GRADES.S,
	},
	judgements: {
		critical: 123,
		miss: 23,
		near: 22,
	},
};

describe("pgScoreDataToMongo", () => {
	it("converts nicely", () => {
		const merged = pgScoreDataToAPI("sdvx", pgSdvxScoreData);

		expect(merged).toStrictEqual({
			enumIndexes: {
				grade: 9,
				lamp: 2,
			},
			grade: "S",
			judgements: {
				critical: 123,
				miss: 23,
				near: 22,
			},
			lamp: "EXCESSIVE CLEAR",
			optional: {
				enumIndexes: {},
				exScore: 123,
				fast: 32,
				gauge: 99,
				maxCombo: 9,
				slow: 42,
			},
			score: 9976543,
		});
	});

	it("roundtrips as expected (sdvx)", () => {
		const pgScoreData = mongoScoreDataToPg("sdvx", sdvxScoreData);
		const merged = pgScoreDataToAPI("sdvx", pgScoreData);

		expect(merged).toStrictEqual(sdvxScoreData);
	});
});

describe("mongoScoreDataToPg", () => {
	it("converts nicely", () => {
		const { data, derived, judgements } = mongoScoreDataToPg("sdvx", sdvxScoreData);

		expect(data).toStrictEqual({
			lamp: SDVX_LAMPS.EXCESSIVE_CLEAR,
			score: 9_876_543,
			exScore: 123,
			fast: 32,
			gauge: 99,
			maxCombo: 9,
			slow: 42,
		});
		expect(derived).toStrictEqual({ grade: SDVX_GRADES.S });
		expect(judgements).toStrictEqual({
			critical: 123,
			miss: 23,
			near: 22,
		});
	});
});
