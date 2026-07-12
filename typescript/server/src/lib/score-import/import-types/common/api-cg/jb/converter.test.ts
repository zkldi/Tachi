import type { DryScore } from "#lib/score-import/framework/common/types";

import { log } from "#lib/log/log";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingJubeatChart, TestingJubeatSong } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import type { CGContext, CGJubeatScore } from "../types";

import { ConverterAPICGJubeat } from "./converter";

const BIT_FAILED = 1 << 0;
const BIT_CLEAR = 1 << 1;
const BIT_FULL_COMBO = 1 << 2;
const BIT_EXCELLENT = 1 << 3;

function mkInput(modifant: Partial<CGJubeatScore> = {}) {
	const validInput: CGJubeatScore = {
		internalId: 10000001,
		difficulty: 1,
		version: 9,
		dateTime: "2019-06-06 08:14:22",
		score: 947_184,
		hardMode: false,
		perfectCount: 100,
		greatCount: 50,
		goodCount: 25,
		poorCount: 0,
		missCount: 0,
		musicRate: 952,
		clearFlag: BIT_FULL_COMBO | BIT_CLEAR | BIT_FAILED,
	};

	return dmf(validInput, modifant);
}

function mkOutput(modifant: Partial<DryScore<"jubeat">> = {}): DryScore<"jubeat"> {
	const validOutput: DryScore<"jubeat"> = {
		comment: null,
		game: "jubeat",
		importType: "api/cg-dev-jubeat",
		timeAchieved: ParseDateFromString("2019-06-06 08:14:22"),
		service: "CG Dev",
		scoreData: {
			score: 947_184,
			lamp: "FULL COMBO",
			judgements: {
				perfect: 100,
				great: 50,
				good: 25,
				poor: 0,
				miss: 0,
			},
			musicRate: 95.2,
			optional: {},
		},
		scoreMeta: {},
	};

	return dmf(validOutput, modifant);
}

async function seedJubeatCgFixture() {
	await DB.insertInto("song")
		.values({
			id: TestingJubeatSong.id,
			legacy_id: 1,
			game_group: "jubeat",
			title: TestingJubeatSong.title,
			artist: TestingJubeatSong.artist,
			search_terms: TestingJubeatSong.searchTerms,
			alt_titles: TestingJubeatSong.altTitles,
			data: TestingJubeatSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingJubeatChart.chartID,
			legacy_id: TestingJubeatChart.chartID,
			game: "jubeat",
			song_id: TestingJubeatSong.id,
			difficulty: TestingJubeatChart.difficulty,
			level: TestingJubeatChart.level,
			level_num: TestingJubeatChart.levelNum,
			is_primary: TestingJubeatChart.isPrimary,
			versions: TestingJubeatChart.versions,
			data: TestingJubeatChart.data,
		})
		.execute();
}

describe("ConverterAPICGJubeat", () => {
	const context: CGContext = {
		service: "dev",
		userID: 1,
	};

	beforeEach(seedJubeatCgFixture);

	const convert = (modifant: Partial<CGJubeatScore> = {}) =>
		ConverterAPICGJubeat(mkInput(modifant), context, "api/cg-dev-jubeat", log);

	it("converts valid input", async () => {
		const res = await convert();

		expect(res.song).toMatchObject({ id: TestingJubeatSong.id });
		expect(res.chart).toMatchObject({
			difficulty: "ADV",
			data: {
				inGameID: 10000001,
			},
		});
		expect(res.dryScore).toStrictEqual(mkOutput());
	});

	describe("lamp from clearFlag bitfield", () => {
		it("interprets EXCELLENT", async () => {
			const clearFlag = BIT_EXCELLENT | BIT_FULL_COMBO | BIT_CLEAR | BIT_FAILED;
			const score = 1_000_000;
			const judgements = {
				perfectCount: 200,
				greatCount: 0,
				goodCount: 0,
				poorCount: 0,
				missCount: 0,
			};

			const res = await convert({
				clearFlag,
				score,
				...judgements,
			});

			expect(res.dryScore).toStrictEqual(
				mkOutput({
					scoreData: {
						lamp: "EXCELLENT",
						score,
						musicRate: 95.2,
						judgements: {
							perfect: 200,
							great: 0,
							good: 0,
							poor: 0,
							miss: 0,
						},
						optional: {},
					},
				}),
			);
		});

		it("interprets FULL COMBO", async () => {
			const clearFlag = BIT_FULL_COMBO | BIT_CLEAR | BIT_FAILED;
			const judgements = {
				perfectCount: 100,
				greatCount: 50,
				goodCount: 25,
				poorCount: 0,
				missCount: 0,
			};
			const score = 947_184;

			const res = await convert({
				clearFlag,
				score,
				...judgements,
			});

			expect(res.dryScore).toStrictEqual(
				mkOutput({
					scoreData: {
						lamp: "FULL COMBO",
						score,
						musicRate: 95.2,
						judgements: {
							perfect: 100,
							great: 50,
							good: 25,
							poor: 0,
							miss: 0,
						},
						optional: {},
					},
				}),
			);
		});

		it("interprets CLEAR", async () => {
			const clearFlag = BIT_CLEAR | BIT_FAILED;
			const score = 750_000;
			const judgements = {
				perfectCount: 90,
				greatCount: 40,
				goodCount: 20,
				poorCount: 5,
				missCount: 1,
			};

			const res = await convert({
				clearFlag,
				score,
				...judgements,
			});

			expect(res.dryScore).toStrictEqual(
				mkOutput({
					scoreData: {
						lamp: "CLEAR",
						score,
						musicRate: 95.2,
						judgements: {
							perfect: 90,
							great: 40,
							good: 20,
							poor: 5,
							miss: 1,
						},
						optional: {},
					},
				}),
			);
		});

		it("interprets FAILED (standard)", async () => {
			const clearFlag = BIT_FAILED;
			const score = 650_000;
			const judgements = {
				perfectCount: 80,
				greatCount: 30,
				goodCount: 15,
				poorCount: 10,
				missCount: 5,
			};

			const res = await convert({
				clearFlag,
				score,
				...judgements,
			});

			expect(res.dryScore).toStrictEqual(
				mkOutput({
					scoreData: {
						lamp: "FAILED",
						score,
						musicRate: 95.2,
						judgements: {
							perfect: 80,
							great: 30,
							good: 15,
							poor: 10,
							miss: 5,
						},
						optional: {},
					},
				}),
			);
		});

		it("interprets FAILED (high score / challenge fail)", async () => {
			const clearFlag = BIT_FAILED;
			const score = 920_000;
			const judgements = {
				perfectCount: 110,
				greatCount: 55,
				goodCount: 30,
				poorCount: 0,
				missCount: 0,
			};

			const res = await convert({
				clearFlag,
				score,
				...judgements,
			});

			expect(res.dryScore).toStrictEqual(
				mkOutput({
					scoreData: {
						lamp: "FAILED",
						score,
						musicRate: 95.2,
						judgements: {
							perfect: 110,
							great: 55,
							good: 30,
							poor: 0,
							miss: 0,
						},
						optional: {},
					},
				}),
			);
		});
	});
});
