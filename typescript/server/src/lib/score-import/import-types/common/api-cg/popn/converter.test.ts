import type { DryScore } from "#lib/score-import/framework/common/types";

import { log } from "#lib/log/log";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingPopnSong } from "#test-utils/test-data";
import { GAME_POPN_CONF, PopnVersions } from "tachi-common/config/game-support/popn";
import { type Versions } from "tachi-common/types/game-config";
import { beforeEach, describe, expect, it } from "vitest";

import type { CGContext, CGPopnScore } from "../types";

import { ConverterAPICGPopn } from "./converter";

const POPN_CG_CHART_ID = "c_test_api_cg_popn_easy_peace";

function mkInput(modifant: Partial<CGPopnScore> = {}) {
	const validInput: CGPopnScore = {
		internalId: 0,
		difficulty: 0,
		coolCount: 100,
		badCount: 50,
		greatCount: 15,
		goodCount: 25,
		clearFlag: 5,
		dateTime: "2019-06-06 08:14:22",
		score: 87_000,
		version: 25,
	};

	return dmf(validInput, modifant);
}

function mkOutput(modifant: Partial<DryScore<"popn">> = {}): DryScore<"popn"> {
	const validOutput: DryScore<"popn"> = {
		comment: null,
		game: "popn",
		importType: "api/cg-dev-popn",
		timeAchieved: ParseDateFromString("2019-06-06 08:14:22"),
		service: "CG Dev",
		scoreData: {
			clearMedal: "clearCircle",
			score: 87_000,
			judgements: {
				cool: 100,
				great: 15,
				good: 25,
				bad: 50,
			},
			optional: {},
		},
		scoreMeta: {},
	};

	return dmf(validOutput, modifant);
}

async function seedPopnCgFixture() {
	await DB.insertInto("song")
		.values({
			id: TestingPopnSong.id,
			legacy_id: 1,
			game_group: "popn",
			title: TestingPopnSong.title,
			artist: TestingPopnSong.artist,
			search_terms: TestingPopnSong.searchTerms,
			alt_titles: TestingPopnSong.altTitles,
			data: TestingPopnSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: POPN_CG_CHART_ID,
			legacy_id: POPN_CG_CHART_ID,
			game: "popn",
			song_id: TestingPopnSong.id,
			difficulty: "Easy",
			level: "5",
			level_num: 5,
			is_primary: true,
			versions: ["peace"],
			data: {
				inGameID: 0,
				hashSHA256: "0000000000000000000000000000000000000000000000000000000000000000",
			},
		})
		.execute();
}

describe("ConverterAPICGPopn", () => {
	const context: CGContext = {
		service: "dev",
		userID: 1,
	};

	beforeEach(seedPopnCgFixture);

	const convert = (modifant: Partial<CGPopnScore> = {}) =>
		ConverterAPICGPopn(mkInput(modifant), context, "api/cg-dev-popn", log);

	it("converts valid input", async () => {
		const res = await convert();

		expect(res.song).toMatchObject({ id: TestingPopnSong.id });
		expect(res.chart).toMatchObject({
			difficulty: "Easy",
			data: {
				inGameID: 0,
			},
		});
		expect(res.dryScore).toStrictEqual(mkOutput());
	});
});

describe("resolves all defined pop'n versions", () => {
	const popnVersionTestCases = Object.keys(GAME_POPN_CONF.versions).map(
		(v) => v as Versions["popn"],
	);

	const versionNumberByName = new Map(
		Array.from(PopnVersions.entries()).map(([versionNumber, versionName]) => [
			versionName,
			versionNumber,
		]),
	);

	it.each(popnVersionTestCases)("resolves version number for %s", (v) => {
		expect(versionNumberByName.get(v)).toBeDefined();
	});
});
