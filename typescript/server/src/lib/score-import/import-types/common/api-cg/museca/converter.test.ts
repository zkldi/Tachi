import type { DryScore } from "#lib/score-import/framework/common/types";

import { log } from "#lib/log/log";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingMusecaSong } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import type { CGContext, CGMusecaScore } from "../types";

import { ConverterAPICGMuseca } from "./converter";

const MUSECA_CG_CHART_ID = "c_test_api_cg_museca_green_15b";

function mkInput(modifant: Partial<CGMusecaScore> = {}) {
	const validInput: CGMusecaScore = {
		internalId: 1,
		difficulty: 0,
		dateTime: "2019-06-06 08:14:22",
		score: 912_000,
		version: 2,
		clearType: 2,
		critical: 100,
		near: 50,
		error: 10,
		maxChain: 300,
		scoreGrade: "whatever, this is unused",
	};

	return dmf(validInput, modifant);
}

function mkOutput(modifant: Partial<DryScore<"museca">> = {}): DryScore<"museca"> {
	const validOutput: DryScore<"museca"> = {
		comment: null,
		game: "museca",
		importType: "api/cg-dev-museca",
		timeAchieved: ParseDateFromString("2019-06-06 08:14:22"),
		service: "CG Dev",
		scoreData: {
			score: 912_000,
			lamp: "CLEAR",
			judgements: {
				critical: 100,
				near: 50,
				miss: 10,
			},
			optional: {
				maxCombo: 300,
			},
		},
		scoreMeta: {},
	};

	return dmf(validOutput, modifant);
}

async function seedMusecaCgFixture() {
	await DB.insertInto("song")
		.values({
			id: TestingMusecaSong.id,
			legacy_id: 1,
			game_group: "museca",
			title: TestingMusecaSong.title,
			artist: TestingMusecaSong.artist,
			search_terms: TestingMusecaSong.searchTerms,
			alt_titles: TestingMusecaSong.altTitles,
			data: TestingMusecaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: MUSECA_CG_CHART_ID,
			legacy_id: MUSECA_CG_CHART_ID,
			game: "museca",
			song_id: TestingMusecaSong.id,
			difficulty: "Green",
			level: "3",
			level_num: 3,
			is_primary: true,
			versions: ["1.5-b"],
			data: {
				inGameID: 1,
			},
		})
		.execute();
}

describe("ConverterAPICGMuseca", () => {
	const context: CGContext = {
		service: "dev",
		userID: 1,
	};

	beforeEach(seedMusecaCgFixture);

	const convert = (modifant: Partial<CGMusecaScore> = {}) =>
		ConverterAPICGMuseca(mkInput(modifant), context, "api/cg-dev-museca", log);

	it("converts valid input", async () => {
		const res = await convert();

		expect(res.song).toMatchObject({ id: TestingMusecaSong.id });
		expect(res.chart).toMatchObject({
			difficulty: "Green",
			data: {
				inGameID: 1,
			},
		});
		expect(res.dryScore).toStrictEqual(mkOutput());
	});

	it("derives lamp from score and misses", async () => {
		await expect(convert({ score: 1_000_000 })).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "PERFECT CONNECT ALL" } },
		});
		await expect(convert({ score: 900_000, error: 0 })).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "CONNECT ALL" } },
		});
		await expect(convert({ score: 800_000, error: 10 })).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "CLEAR" } },
		});
		await expect(convert({ score: 700_000, error: 10 })).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "FAILED" } },
		});
		await expect(convert({ score: 799_999, error: 10 })).resolves.toMatchObject({
			dryScore: { scoreData: { lamp: "FAILED" } },
		});
	});
});
