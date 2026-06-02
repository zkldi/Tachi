import type { DryScore } from "#lib/score-import/framework/common/types";
import type { Versions } from "tachi-common";

import { log } from "#lib/log/log";
import { InvalidScoreFailure } from "#lib/score-import/framework/common/converter-failures";
import { ParseDateFromString } from "#lib/score-import/framework/common/score-utils";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { TestingAlbidaADV, TestingSDVXAlbidaSong } from "#test-utils/test-data";
import { beforeEach, describe, expect, it } from "vitest";

import type { CGContext, CGSDVXScore } from "../types";

import { ConvertCGSDVXLamp, ConverterAPICGSDVX } from "./converter";

function mkInput(modifant: Partial<CGSDVXScore> = {}) {
	const validInput: CGSDVXScore = {
		internalId: 1,
		difficulty: 1,
		dateTime: "2019-06-06 08:14:22",
		score: 9_123_000,
		version: 6,
		clearType: 2,
		critical: 100,
		near: 50,
		error: 10,
		exScore: 1234,
		maxChain: 300,
		scoreGrade: "whatever, this is unused",
	};

	return dmf(validInput, modifant);
}

function mkOutput(modifant: Partial<DryScore<"sdvx">> = {}): DryScore<"sdvx"> {
	const validOutput: DryScore<"sdvx"> = {
		comment: null,
		game: "sdvx",
		importType: "api/cg-dev-sdvx",
		timeAchieved: ParseDateFromString("2019-06-06 08:14:22"),
		service: "CG Dev",
		scoreData: {
			score: 9_123_000,
			lamp: "CLEAR",
			judgements: {
				critical: 100,
				near: 50,
				miss: 10,
			},
			optional: {
				maxCombo: 300,
				exScore: 1234,
			},
		},
		scoreMeta: {},
	};

	return dmf(validOutput, modifant);
}

async function seedSdvxCgFixture(chartVersions: Versions["sdvx"][] = TestingAlbidaADV.versions) {
	await DB.insertInto("song")
		.values({
			id: TestingSDVXAlbidaSong.id,
			legacy_id: 1,
			game_group: "sdvx",
			title: TestingSDVXAlbidaSong.title,
			artist: TestingSDVXAlbidaSong.artist,
			search_terms: TestingSDVXAlbidaSong.searchTerms,
			alt_titles: TestingSDVXAlbidaSong.altTitles,
			data: TestingSDVXAlbidaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: TestingAlbidaADV.chartID,
			legacy_id: TestingAlbidaADV.chartID,
			game: "sdvx",
			song_id: TestingSDVXAlbidaSong.id,
			difficulty: "ADV",
			level: TestingAlbidaADV.level,
			level_num: TestingAlbidaADV.levelNum,
			is_primary: TestingAlbidaADV.isPrimary,
			versions: chartVersions,
			data: TestingAlbidaADV.data,
		})
		.execute();
}

/** CG clearType → lamp; v6 (exceed) and v7 (nabla) permute UC/PUC/MAXXIVE (4/5/6). */
const cgSdvxLampByVersion = [
	{ gameVersion: "exceed", clearType: 1, lamp: "FAILED" },
	{ gameVersion: "exceed", clearType: 2, lamp: "CLEAR" },
	{ gameVersion: "exceed", clearType: 3, lamp: "EXCESSIVE CLEAR" },
	{ gameVersion: "exceed", clearType: 4, lamp: "ULTIMATE CHAIN" },
	{ gameVersion: "exceed", clearType: 5, lamp: "PERFECT ULTIMATE CHAIN" },
	{ gameVersion: "exceed", clearType: 6, lamp: "MAXXIVE CLEAR" },
	{ gameVersion: "nabla", clearType: 1, lamp: "FAILED" },
	{ gameVersion: "nabla", clearType: 2, lamp: "CLEAR" },
	{ gameVersion: "nabla", clearType: 3, lamp: "EXCESSIVE CLEAR" },
	{ gameVersion: "nabla", clearType: 4, lamp: "MAXXIVE CLEAR" },
	{ gameVersion: "nabla", clearType: 5, lamp: "ULTIMATE CHAIN" },
	{ gameVersion: "nabla", clearType: 6, lamp: "PERFECT ULTIMATE CHAIN" },
] as const satisfies ReadonlyArray<{
	clearType: number;
	gameVersion: Versions["sdvx"];
	lamp: DryScore<"sdvx">["scoreData"]["lamp"];
}>;

/**
 * v6→v7 clearType remap for UC/PUC/MAXXIVE: 4↔5↔6 cycle (same lamp, different enum id).
 */
const cgSdvxCrossVersionLampEquivalence = [
	{ exceedClearType: 4, nablaClearType: 5, lamp: "ULTIMATE CHAIN" },
	{ exceedClearType: 5, nablaClearType: 6, lamp: "PERFECT ULTIMATE CHAIN" },
	{ exceedClearType: 6, nablaClearType: 4, lamp: "MAXXIVE CLEAR" },
] as const satisfies ReadonlyArray<{
	exceedClearType: number;
	lamp: DryScore<"sdvx">["scoreData"]["lamp"];
	nablaClearType: number;
}>;

describe("ConvertCGSDVXLamp", () => {
	it.each(cgSdvxLampByVersion)("maps clearType $clearType at $gameVersion to $lamp", ({
		gameVersion,
		clearType,
		lamp,
	}) => {
		expect(ConvertCGSDVXLamp(gameVersion, clearType)).toBe(lamp);
	});

	it.each(
		cgSdvxCrossVersionLampEquivalence,
	)("exceed clearType $exceedClearType and nabla clearType $nablaClearType both mean $lamp", ({
		exceedClearType,
		nablaClearType,
		lamp,
	}) => {
		expect(ConvertCGSDVXLamp("exceed", exceedClearType)).toBe(lamp);
		expect(ConvertCGSDVXLamp("nabla", nablaClearType)).toBe(lamp);
	});

	it("rejects unknown clearType", () => {
		expect(() => ConvertCGSDVXLamp("exceed", 99)).toThrow(InvalidScoreFailure);
		expect(() => ConvertCGSDVXLamp("nabla", 0)).toThrow(InvalidScoreFailure);
	});
});

describe("ConverterAPICGSDVX", () => {
	const context: CGContext = {
		service: "dev",
		userID: 1,
	};

	beforeEach(() => seedSdvxCgFixture([...TestingAlbidaADV.versions, "nabla"]));

	const convert = (modifant: Partial<CGSDVXScore> = {}) =>
		ConverterAPICGSDVX(mkInput(modifant), context, "api/cg-dev-sdvx", log);

	const lampOnly = (lamp: DryScore<"sdvx">["scoreData"]["lamp"]) =>
		mkOutput({
			scoreData: {
				score: 9_123_000,
				lamp,
				judgements: { critical: 100, near: 50, miss: 10 },
				optional: { maxCombo: 300, exScore: 1234 },
			},
		});

	it("converts valid input", async () => {
		const res = await convert();

		expect(res.song).toMatchObject({ id: TestingSDVXAlbidaSong.id });
		expect(res.chart).toMatchObject({
			difficulty: "ADV",
			data: {
				inGameID: 1,
			},
		});
		expect(res.dryScore).toStrictEqual(mkOutput());
	});

	it.each(
		cgSdvxLampByVersion.filter((c) => c.gameVersion === "exceed"),
	)("maps exceed (v6) clearType $clearType to $lamp end-to-end", async ({ clearType, lamp }) => {
		await expect(convert({ version: 6, clearType })).resolves.toMatchObject({
			dryScore: lampOnly(lamp),
		});
	});

	describe("nabla (v7) scores", () => {
		it.each(
			cgSdvxLampByVersion.filter((c) => c.gameVersion === "nabla"),
		)("maps nabla clearType $clearType to $lamp end-to-end", async ({ clearType, lamp }) => {
			await expect(convert({ version: 7, clearType })).resolves.toMatchObject({
				dryScore: lampOnly(lamp),
			});
		});

		it.each(
			cgSdvxCrossVersionLampEquivalence,
		)("v7 clearType $nablaClearType matches exceed clearType $exceedClearType lamp $lamp", async ({
			exceedClearType,
			nablaClearType,
			lamp,
		}) => {
			const fromExceed = await convert({ version: 6, clearType: exceedClearType });
			const fromNabla = await convert({ version: 7, clearType: nablaClearType });

			expect((fromExceed.dryScore as DryScore<"sdvx">).scoreData.lamp).toBe(lamp);
			expect((fromNabla.dryScore as DryScore<"sdvx">).scoreData.lamp).toBe(lamp);
			expect((fromNabla.dryScore as DryScore<"sdvx">).scoreData.lamp).toBe(
				(fromExceed.dryScore as DryScore<"sdvx">).scoreData.lamp,
			);
		});
	});
});
