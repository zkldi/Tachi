import { log } from "#lib/log/log";
import { SongOrChartNotFoundFailure } from "#lib/score-import/framework/common/converter-failures";
import DB from "#services/pg/db";
import {
	MockBarbatosScore,
	MockBarbatosSDVX6Score,
	TestingAlbidaADV,
	TestingSDVXAlbidaSong,
} from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import type { BarbatosScore } from "./types";

import { ConverterIRBarbatos } from "./converter";

async function seedAlbidaAdvVersions() {
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
			versions: TestingAlbidaADV.versions,
			data: TestingAlbidaADV.data,
		})
		.execute();
}

describe("ConverterIRBarbatos", () => {
	beforeEach(seedAlbidaAdvVersions);

	it("converts a BarbatosScore into a dry score", async () => {
		const res = await ConverterIRBarbatos(
			MockBarbatosScore,
			{ timeReceived: 10, version: "vivid" },
			"ir/barbatos",
			log,
		);

		expect(res.song.id).toBe(TestingSDVXAlbidaSong.id);
		expect(res.chart.chartID).toBe(TestingAlbidaADV.chartID);
		expect(res.dryScore).toMatchObject({
			game: "sdvx",
			service: "Barbatos (vivid)",
			comment: null,
			importType: "ir/barbatos",
			timeAchieved: 10,
			scoreData: {
				score: 9_000_000,
				lamp: "CLEAR",
				judgements: {
					critical: 100,
					near: 50,
					miss: 5,
				},
				optional: {
					fast: 40,
					slow: 10,
					gauge: 90,
					maxCombo: 100,
					exScore: null,
				},
			},
			scoreMeta: {
				inSkillAnalyser: false,
			},
		});
	});

	it("converts a BarbatosSDVX6Score into a dry score", async () => {
		const res = await ConverterIRBarbatos(
			MockBarbatosSDVX6Score,
			{ timeReceived: 10, version: "exceed" },
			"ir/barbatos",
			log,
		);

		expect(res.song.id).toBe(TestingSDVXAlbidaSong.id);
		expect(res.chart.chartID).toBe(TestingAlbidaADV.chartID);
		expect(res.dryScore).toMatchObject({
			game: "sdvx",
			service: "Barbatos (exceed)",
			comment: null,
			importType: "ir/barbatos",
			timeAchieved: 10,
			scoreData: {
				score: 9_000_000,
				lamp: "CLEAR",
				judgements: {
					critical: 26,
					near: 2,
					miss: 17,
				},
				optional: {
					fast: 6,
					slow: 9,
					gauge: 90,
					maxCombo: 100,
					exScore: 1234,
				},
			},
			scoreMeta: {
				inSkillAnalyser: null,
			},
		});
	});

	it("throws SongOrChartNotFoundFailure when the chart is missing", async () => {
		const err = await ConverterIRBarbatos(
			deepmerge(MockBarbatosScore, { song_id: 1000 }) as BarbatosScore,
			{ timeReceived: 10, version: "vivid" },
			"ir/barbatos",
			log,
		).catch((e: unknown) => e);

		expect(err).toBeInstanceOf(SongOrChartNotFoundFailure);
		expect((err as Error).message).toMatch(/Could not find chart with songID 1000/u);
	});

	it("requires context.version to be listed on the chart versions", async () => {
		await DB.updateTable("chart")
			.set({
				versions: TestingAlbidaADV.versions.filter((v) => v !== "vivid"),
			})
			.where("id", "=", TestingAlbidaADV.chartID)
			.execute();

		await expect(
			ConverterIRBarbatos(
				MockBarbatosScore,
				{ timeReceived: 10, version: "vivid" },
				"ir/barbatos",
				log,
			),
		).rejects.toBeInstanceOf(SongOrChartNotFoundFailure);
	});
});
