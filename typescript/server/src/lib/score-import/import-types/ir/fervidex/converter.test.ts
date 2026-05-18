import { log } from "#lib/log/log";
import {
	InternalFailure,
	SkipScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { HydrateScore } from "#lib/score-import/framework/score-importing/hydrate-score";
import { CreateScoreID } from "#lib/score-import/framework/score-importing/score-id";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { Testing511Song, Testing511SPA, TestingIIDXSPDryScore } from "#test-utils/test-data";
import deepmerge from "deepmerge";
import { beforeEach, describe, expect, it } from "vitest";

import type { FervidexScore } from "./types";

import {
	ConverterIRFervidex,
	SplitFervidexChartRef,
	TachifyAssist,
	TachifyGauge,
	TachifyRandom,
	TachifyRange,
} from "./converter";

const baseFervidexScore: FervidexScore = {
	bad: 0,
	chart: "spa",
	clear_type: 1,
	combo_break: 6,
	custom: false,
	chart_sha256: "asdfasdf",
	entry_id: 1000,
	ex_score: 68,
	fast: 0,
	gauge: [100, 50],
	ghost: [0, 2],
	good: 0,
	great: 0,
	max_combo: 34,
	option: {
		gauge: "HARD",
		range: "SUDDEN_PLUS",
		style: "RANDOM",
	},
	pacemaker: {
		name: "",
		score: 363,
		type: "PACEMAKER_A",
	},
	pgreat: 34,
	poor: 6,
	slow: 0,
};

const baseDryScore = {
	game: "iidx-sp" as const,
	service: "Fervidex",
	comment: null,
	importType: "ir/fervidex",
	scoreData: {
		score: 68,
		lamp: "FAILED",
		judgements: {
			pgreat: 34,
			great: 0,
			good: 0,
			bad: 0,
			poor: 6,
		},
		optional: {
			fast: 0,
			slow: 0,
			maxCombo: null,
			gaugeHistory: [100, 50],
			scoreHistory: [0, 2],
			gauge: 50,
			bp: 6,
			comboBreak: 6,
		},
	},
	scoreMeta: {
		assist: "NO ASSIST",
		gauge: "HARD",
		random: "RANDOM",
		range: "SUDDEN+",
	},
};

async function seed511SpaAndDpa() {
	await DB.insertInto("song")
		.values({
			id: Testing511Song.id,
			legacy_id: 511,
			game_group: "iidx",
			title: Testing511Song.title,
			artist: Testing511Song.artist,
			search_terms: Testing511Song.searchTerms,
			alt_titles: Testing511Song.altTitles,
			data: Testing511Song.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: Testing511SPA.chartID,
			legacy_id: Testing511SPA.chartID,
			game: "iidx-sp",
			song_id: Testing511Song.id,
			difficulty: "ANOTHER",
			level: Testing511SPA.level,
			level_num: Testing511SPA.levelNum,
			is_primary: Testing511SPA.isPrimary,
			versions: Testing511SPA.versions,
			data: Testing511SPA.data,
		})
		.execute();

	const dpa = dmf(Testing511SPA, {
		game: "iidx-dp",
		chartID: "dp_test",
		data: { inGameID: 1000 },
	} as never);

	await DB.insertInto("chart")
		.values({
			id: dpa.chartID,
			legacy_id: dpa.chartID,
			game: "iidx-dp",
			song_id: Testing511Song.id,
			difficulty: "ANOTHER",
			level: dpa.level,
			level_num: dpa.levelNum,
			is_primary: dpa.isPrimary,
			versions: Testing511SPA.versions,
			data: dpa.data,
		})
		.execute();
}

describe("SplitFervidexChartRef", () => {
	it("maps fervidex chart codes to game and difficulty", () => {
		expect(SplitFervidexChartRef("spn")).toEqual({ game: "iidx-sp", difficulty: "NORMAL" });
		expect(SplitFervidexChartRef("sph")).toEqual({ game: "iidx-sp", difficulty: "HYPER" });
		expect(SplitFervidexChartRef("spa")).toEqual({ game: "iidx-sp", difficulty: "ANOTHER" });
		expect(SplitFervidexChartRef("spl")).toEqual({
			game: "iidx-sp",
			difficulty: "LEGGENDARIA",
		});
		expect(SplitFervidexChartRef("dpn")).toEqual({ game: "iidx-dp", difficulty: "NORMAL" });
		expect(SplitFervidexChartRef("dph")).toEqual({ game: "iidx-dp", difficulty: "HYPER" });
		expect(SplitFervidexChartRef("dpa")).toEqual({ game: "iidx-dp", difficulty: "ANOTHER" });
		expect(SplitFervidexChartRef("dpl")).toEqual({
			game: "iidx-dp",
			difficulty: "LEGGENDARIA",
		});
	});

	it("throws InternalFailure on invalid difficulty", () => {
		expect(() => SplitFervidexChartRef("INVALID" as "spn")).toThrow(InternalFailure);
		expect(() => SplitFervidexChartRef("INVALID" as "spn")).toThrow(
			/Invalid fervidex difficulty of INVALID/u,
		);
	});

	it("throws SkipScoreFailure for BEGINNER charts", () => {
		expect(() => SplitFervidexChartRef("spb")).toThrow(SkipScoreFailure);
		expect(() => SplitFervidexChartRef("spb")).toThrow(/BEGINNER charts are not supported/u);
	});
});

describe("TachifyAssist", () => {
	it("normalizes assist options", () => {
		expect(TachifyAssist("ASCR_LEGACY")).toBe("FULL ASSIST");
		expect(TachifyAssist("AUTO_SCRATCH")).toBe("AUTO SCRATCH");
		expect(TachifyAssist("FULL_ASSIST")).toBe("FULL ASSIST");
		expect(TachifyAssist("LEGACY_NOTE")).toBe("LEGACY NOTE");
		expect(TachifyAssist(null)).toBe("NO ASSIST");
		expect(TachifyAssist(undefined)).toBe("NO ASSIST");
	});
});

describe("TachifyGauge", () => {
	it("normalizes gauge options", () => {
		expect(TachifyGauge("ASSISTED_EASY")).toBe("ASSISTED EASY");
		expect(TachifyGauge("EASY")).toBe("EASY");
		expect(TachifyGauge("HARD")).toBe("HARD");
		expect(TachifyGauge("EX_HARD")).toBe("EX-HARD");
		expect(TachifyGauge(null)).toBe("NORMAL");
		expect(TachifyGauge(undefined)).toBe("NORMAL");
	});
});

describe("TachifyRange", () => {
	it("normalizes range options", () => {
		expect(TachifyRange("HIDDEN_PLUS")).toBe("HIDDEN+");
		expect(TachifyRange("LIFT")).toBe("LIFT");
		expect(TachifyRange("LIFT_SUD_PLUS")).toBe("LIFT SUD+");
		expect(TachifyRange("SUDDEN_PLUS")).toBe("SUDDEN+");
		expect(TachifyRange("SUD_PLUS_HID_PLUS")).toBe("SUD+ HID+");
		expect(TachifyRange(null)).toBe("NONE");
		expect(TachifyRange(undefined)).toBe("NONE");
	});
});

describe("TachifyRandom", () => {
	it("normalizes random options", () => {
		expect(TachifyRandom("MIRROR")).toBe("MIRROR");
		expect(TachifyRandom("R_RANDOM")).toBe("R-RANDOM");
		expect(TachifyRandom("S_RANDOM")).toBe("S-RANDOM");
		expect(TachifyRandom("RANDOM")).toBe("RANDOM");
		expect(TachifyRandom(null)).toBe("NONRAN");
		expect(TachifyRandom(undefined)).toBe("NONRAN");
	});
});

describe("ConverterIRFervidex", () => {
	beforeEach(seed511SpaAndDpa);

	it("converts a valid fervidex score into a dry score", async () => {
		const res = await ConverterIRFervidex(
			baseFervidexScore,
			{ version: "27", timeReceived: 10, userID: 1 },
			"ir/fervidex",
			log,
		);

		expect(res.song.id).toBe(Testing511Song.id);
		expect(res.chart.chartID).toBe(Testing511SPA.chartID);
		expect(res.dryScore).toMatchObject(baseDryScore);
	});

	it("turns DP randoms into tuples", async () => {
		const res = await ConverterIRFervidex(
			deepmerge(baseFervidexScore, { option: { style_2p: "R_RANDOM" }, chart: "dpa" }),
			{ version: "27", timeReceived: 10, userID: 1 },
			"ir/fervidex",
			log,
		);

		expect(res.chart.chartID).toBe("dp_test");
		expect(res.dryScore).toMatchObject(
			deepmerge(baseDryScore, {
				game: "iidx-dp",
				scoreMeta: { random: ["RANDOM", "R-RANDOM"] },
			}),
		);
	});

	it("nulls BP when the player died pre-emptively", async () => {
		const res = await ConverterIRFervidex(
			deepmerge(baseFervidexScore, { dead: { measure: 1, note: 10 } }),
			{ version: "27", timeReceived: 10, userID: 1 },
			"ir/fervidex",
			log,
		);

		expect((res.dryScore.scoreData.optional as { bp: number | null }).bp).toBeNull();
	});

	it("rejects scores on unknown charts", async () => {
		await expect(
			ConverterIRFervidex(
				deepmerge(baseFervidexScore, { chart: "spl" }),
				{ version: "27", timeReceived: 10, userID: 1 },
				"ir/fervidex",
				log,
			),
		).rejects.toBeInstanceOf(SongOrChartNotFoundFailure);
	});

	it("maps overflow gauge samples to null", async () => {
		const res = await ConverterIRFervidex(
			{ ...baseFervidexScore, gauge: [10, 5, 249, 248] },
			{ version: "27", timeReceived: 10, userID: 1 },
			"ir/fervidex",
			log,
		);

		expect(res.dryScore.scoreData.optional).toMatchObject({
			gauge: null,
			gaugeHistory: [10, 5, null, null],
		});
	});

	it("sets highlight on an existing score when fervidex marks highlight", async () => {
		const { id: userId } = await seedUser({ username: "fervidex_highlight" });

		const scoreForId = deepmerge(baseFervidexScore, {
			ex_score: TestingIIDXSPDryScore.scoreData.score,
			clear_type: 4,
			chart: "spa",
			entry_id: 1000,
		});

		const { dryScore, chart, song } = await ConverterIRFervidex(
			scoreForId as FervidexScore,
			{ version: "27", timeReceived: 10, userID: userId },
			"ir/fervidex",
			log,
		);

		const scoreID = CreateScoreID("iidx-sp", userId, dryScore, chart.legacyChartID);
		const hydrated = HydrateScore(userId, dryScore, chart, song, scoreID, log);
		const { data, derived, judgements } = mongoScoreDataToPg("iidx-sp", hydrated.scoreData);
		const now = new Date().toISOString();

		await DB.insertInto("score")
			.values({
				id: scoreID,
				user_id: userId,
				chart_id: chart.chartID,
				game: "iidx-sp",
				session_id: null,
				import_id: null,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: JSON.stringify(judgements),
				calculated_data: JSON.stringify(hydrated.calculatedData),
				meta: JSON.stringify(hydrated.scoreMeta ?? {}),
				time_achieved: now,
				time_added: now,
				highlight: false,
				comment: null,
			})
			.execute();

		await ConverterIRFervidex(
			deepmerge(scoreForId, { highlight: true }) as FervidexScore,
			{ version: "27", timeReceived: 10, userID: userId },
			"ir/fervidex",
			log,
		);

		const row = await DB.selectFrom("score")
			.select("highlight")
			.where("id", "=", scoreID)
			.executeTakeFirst();

		expect(row?.highlight).toBe(true);
	});
});
