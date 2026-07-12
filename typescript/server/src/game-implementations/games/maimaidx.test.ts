import { MAIMAIDX_IMPL } from "#game-implementations/games/maimaidx";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingMaimaiDXChart, TestingMaimaiDXSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	type MongoProvidedMetrics,
	type ScoreData,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

function enumMetricValues(m: {
	type: string;
	values?: ReadonlyArray<string>;
}): ReadonlyArray<string> {
	if (m.type !== "ENUM" || m.values === undefined) {
		throw new Error("expected ENUM metric with values");
	}
	return m.values;
}

const chart = TestingMaimaiDXChart;

const MAIMAIDX_CONF = GetGameConfig("maimaidx");
const GRADES = enumMetricValues(MAIMAIDX_CONF.derivedMetrics.grade);
const LAMPS = enumMetricValues(MAIMAIDX_CONF.providedMetrics.lamp);

const baseMetrics: MongoProvidedMetrics["maimaidx"] = {
	lamp: "CLEAR",
	percent: 97.012,
};

const scoreData: ScoreData<"maimaidx"> = {
	lamp: "CLEAR",
	percent: 97.012,
	grade: "SS",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: GRADES.indexOf("SS"),
		lamp: LAMPS.indexOf("CLEAR"),
	},
};

async function seedMaimaiDxChart() {
	await DB.insertInto("song")
		.values({
			id: TestingMaimaiDXSong.id,
			legacy_id: 1,
			game_group: "maimaidx",
			title: TestingMaimaiDXSong.title,
			artist: TestingMaimaiDXSong.artist,
			search_terms: TestingMaimaiDXSong.searchTerms,
			alt_titles: TestingMaimaiDXSong.altTitles,
			data: TestingMaimaiDXSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "maimaidx",
			song_id: TestingMaimaiDXSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertMaimaiDxScore(opts: {
	scoreId: string;
	sd: ScoreData<"maimaidx">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("maimaidx", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "maimaidx",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({}),
			time_achieved: ts,
			time_added: ts,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("MAIMAIDX_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		const g = (percent: number, expected: string) =>
			expect(
				MAIMAIDX_IMPL.scoreDeriver(dmf(baseMetrics, { percent }) as never, chart as never)
					.grade,
			).toBe(expected);

		it("maps percent to grade", () => {
			g(0, "D");
			g(50, "C");
			g(60, "B");
			g(70, "BB");
			g(75, "BBB");
			g(80, "A");
			g(90, "AA");
			g(94, "AAA");
			g(97, "S");
			g(98, "S+");
			g(99, "SS");
			g(99.5, "SS+");
			g(100, "SSS");
			g(100.5, "SSS+");
		});
	});

	describe("classDerivers", () => {
		const c = (
			v: number | null,
			expected: ReturnType<typeof MAIMAIDX_IMPL.classDerivers>["colour"],
		) => expect(MAIMAIDX_IMPL.classDerivers({ naiveRate: v }).colour).toBe(expected);

		it("maps rate to colour", () => {
			c(null, null);
			c(0, "WHITE");
			c(16750, "RAINBOW_EX_IV");
			c(16500, "RAINBOW_EX_III");
			c(16250, "RAINBOW_EX_II");
			c(16000, "RAINBOW_EX_I");
			c(15750, "RAINBOW_IV");
			c(15500, "RAINBOW_III");
			c(15250, "RAINBOW_II");
			c(15000, "RAINBOW");
			c(14750, "PLATINUM_II");
			c(14500, "PLATINUM");
			c(14250, "GOLD_II");
			c(14000, "GOLD");
			c(13000, "SILVER");
			c(12000, "BRONZE");
			c(10000, "PURPLE");
			c(7000, "RED");
			c(4000, "YELLOW");
			c(2000, "GREEN");
			c(1000, "BLUE");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("maimaidx", chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "percent", value: 93.1415, mode: "single" }, "maimaidx"),
			).toBe("Get 93.1415% on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.maimaidx;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"maimaidx">>,
				goalValue: number,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "S", percent: 97.5 }, GRADES.indexOf("SS"), "(S+)-0.5000%");
			f("percent", { percent: 98.23 }, 1_000_000, "98.2300%");
			f("lamp", { lamp: "CLEAR" }, LAMPS.indexOf("CLEAR"), "CLEAR");
		});

		it("outOf", () => {
			const percentMetric = GetScoreMetricConf(GetGameConfig("maimaidx"), "percent") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(percentMetric.goalOutOfFormatter(99.1123)).toBe("99.1123%");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedMaimaiDxChart);

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: "maimaidx_pb" });
			const main = mkMockScore("maimaidx", chart, scoreData);

			const lampSd: ScoreData<"maimaidx"> = {
				...scoreData,
				percent: 0,
				lamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: LAMPS.indexOf("FULL COMBO"),
				},
			};

			await insertMaimaiDxScore({
				userId,
				scoreId: main.scoreID,
				sd: scoreData,
				timeMs: 1000,
			});
			await insertMaimaiDxScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

			const pb = await CreatePBDoc("maimaidx", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Percent" },
					{ name: "Best Lamp", scoreID: "bestLamp" },
				],
				scoreData: {
					percent: scoreData.percent,
					lamp: "FULL COMBO",
					enumIndexes: { lamp: LAMPS.indexOf("FULL COMBO") },
				},
			});
		});
	});
});
