import { MAIMAI_IMPL } from "#game-implementations/games/maimai";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingMaimaiChart, TestingMaimaiSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	type integer,
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

const chart = TestingMaimaiChart;

const MAIMAI_CONF = GetGameConfig("maimai");
const GRADES = enumMetricValues(MAIMAI_CONF.derivedMetrics.grade);
const LAMPS = enumMetricValues(MAIMAI_CONF.providedMetrics.lamp);

const baseMetrics: MongoProvidedMetrics["maimai"] = {
	lamp: "CLEAR",
	percent: 97.01,
};

const scoreData: ScoreData<"maimai"> = {
	lamp: "CLEAR",
	percent: 97.01,
	grade: "S",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: GRADES.indexOf("S"),
		lamp: LAMPS.indexOf("CLEAR"),
	},
};

async function seedMaimaiChart() {
	await DB.insertInto("song")
		.values({
			id: TestingMaimaiSong.id,
			legacy_id: 834,
			game_group: "maimai",
			title: TestingMaimaiSong.title,
			artist: TestingMaimaiSong.artist,
			search_terms: TestingMaimaiSong.searchTerms,
			alt_titles: TestingMaimaiSong.altTitles,
			data: TestingMaimaiSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "maimai",
			song_id: TestingMaimaiSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertMaimaiScore(opts: {
	scoreId: string;
	sd: ScoreData<"maimai">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("maimai", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "maimai",
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

describe("MAIMAI_IMPL", () => {
	describe("chartSpecificValidators.percent", () => {
		it("accepts in-range percent", () => {
			expect(MAIMAI_IMPL.chartSpecificValidators.percent(100.78, chart)).toBe(true);
			expect(MAIMAI_IMPL.chartSpecificValidators.percent(0, chart)).toBe(true);
		});

		it("rejects out-of-range percent", () => {
			expect(MAIMAI_IMPL.chartSpecificValidators.percent(-1, chart)).toBe(
				"Percent cannot be negative.",
			);
			expect(MAIMAI_IMPL.chartSpecificValidators.percent(101, chart)).toBe(
				`Percent cannot be greater than ${chart.data.maxPercent} for this chart.`,
			);
		});
	});

	describe("scoreDeriver (grade)", () => {
		const g = (percent: number, expected: string) =>
			expect(
				MAIMAI_IMPL.scoreDeriver(dmf(baseMetrics, { percent }) as never, chart as never)
					.grade,
			).toBe(expected);

		it("maps percent to grade", () => {
			g(0, "F");
			g(10, "E");
			g(20, "D");
			g(40, "C");
			g(60, "B");
			g(80, "A");
			g(90, "AA");
			g(94, "AAA");
			g(97, "S");
			g(98, "S+");
			g(99, "SS");
			g(99.5, "SS+");
			g(100, "SSS");
			g(100.78, "SSS+");
		});
	});

	it("scoreCalcs rate", () => {
		expect(
			MAIMAI_IMPL.scoreCalcs(scoreData, MAIMAI_IMPL.scoreDeriver(scoreData, chart), chart)
				.rate,
		).toBe(14.85);
	});

	describe("classDerivers", () => {
		const c = (
			v: number | null,
			expected: ReturnType<typeof MAIMAI_IMPL.classDerivers>["colour"],
		) => expect(MAIMAI_IMPL.classDerivers({ naiveRate: v }).colour).toBe(expected);

		it("maps rate to colour", () => {
			c(null, null);
			c(0, "WHITE");
			c(15, "RAINBOW");
			c(14.5, "GOLD");
			c(14, "SILVER");
			c(13, "BRONZE");
			c(12, "PURPLE");
			c(10, "RED");
			c(7, "YELLOW");
			c(4, "GREEN");
			c(2, "BLUE");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("maimai", chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "percent", value: 93.14, mode: "single" }, "maimai"),
			).toBe("Get 93.14% on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.maimai;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"maimai">>,
				goalValue: integer,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "S", percent: 97.5 }, GRADES.indexOf("SS"), "(S+)-0.50%");
			f("grade", { grade: "S", percent: 97.5 }, GRADES.indexOf("SSS+"), "(S+)-0.50%");
			f("grade", { grade: "SSS", percent: 100.2 }, GRADES.indexOf("SSS+"), "SSS+0.20%");
			f("grade", { grade: "SSS+", percent: 100.78 }, GRADES.indexOf("SSS+"), "SSS+");
			f("percent", { percent: 98.23 }, 1_000_000, "98.23%");
			f("lamp", { lamp: "CLEAR" }, LAMPS.indexOf("CLEAR"), "CLEAR");
		});

		it("outOf", () => {
			const percentMetric = GetScoreMetricConf(GetGameConfig("maimai"), "percent") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(percentMetric.goalOutOfFormatter(99.11)).toBe("99.11%");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedMaimaiChart);

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: "maimai_pb" });
			const main = mkMockScore("maimai", chart, scoreData);

			const lampSd: ScoreData<"maimai"> = {
				...scoreData,
				percent: 0,
				lamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: LAMPS.indexOf("FULL COMBO"),
				},
			};

			await insertMaimaiScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertMaimaiScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

			const pb = await CreatePBDoc("maimai", userId, chart, log);

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
