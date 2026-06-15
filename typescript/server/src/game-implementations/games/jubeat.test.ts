import { JUBEAT_IMPL } from "#game-implementations/games/jubeat";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingJubeatChart, TestingJubeatSong } from "#test-utils/test-data";
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

const chart = TestingJubeatChart;

const JUBEAT_CONF = GetGameConfig("jubeat");
const GRADES = enumMetricValues(JUBEAT_CONF.derivedMetrics.grade);
const LAMPS = enumMetricValues(JUBEAT_CONF.providedMetrics.lamp);

const baseMetrics: MongoProvidedMetrics["jubeat"] = {
	lamp: "CLEAR",
	musicRate: 84.21,
	score: 970_000,
};

const scoreData: ScoreData<"jubeat"> = {
	lamp: "CLEAR",
	musicRate: 84.21,
	score: 970_000,
	grade: "SS",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: GRADES.indexOf("SS"),
		lamp: LAMPS.indexOf("CLEAR"),
	},
};

async function seedJubeatChart() {
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
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "jubeat",
			song_id: TestingJubeatSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertJubeatScore(opts: {
	scoreId: string;
	sd: ScoreData<"jubeat">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("jubeat", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "jubeat",
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

describe("JUBEAT_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		const g = (score: number, expected: string) =>
			expect(
				JUBEAT_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never)
					.grade,
			).toBe(expected);

		it("maps score thresholds to letter grades", () => {
			g(0, "E");
			g(500_000, "D");
			g(700_000, "C");
			g(800_000, "B");
			g(850_000, "A");
			g(900_000, "S");
			g(950_000, "SS");
			g(980_000, "SSS");
			g(1_000_000, "EXC");
		});
	});

	describe("chartSpecificValidators.musicRate", () => {
		it("accepts in-range music rate", () => {
			expect(JUBEAT_IMPL.chartSpecificValidators.musicRate(80, chart)).toBe(true);
			expect(JUBEAT_IMPL.chartSpecificValidators.musicRate(0, chart)).toBe(true);
			expect(JUBEAT_IMPL.chartSpecificValidators.musicRate(100, chart)).toBe(true);
			expect(
				JUBEAT_IMPL.chartSpecificValidators.musicRate(
					120,
					dmf(TestingJubeatChart, { difficulty: "HARD ADV" }) as never,
				),
			).toBe(true);
		});

		it("rejects out-of-range music rate", () => {
			expect(JUBEAT_IMPL.chartSpecificValidators.musicRate(-1, chart)).toBe(
				"Expected a number between 0 and 100.",
			);
			expect(
				JUBEAT_IMPL.chartSpecificValidators.musicRate(
					100.1,
					dmf(TestingJubeatChart, { difficulty: "ADV" }) as never,
				),
			).toBe("Expected a number between 0 and 100.");
			expect(
				JUBEAT_IMPL.chartSpecificValidators.musicRate(
					120.1,
					dmf(TestingJubeatChart, { difficulty: "HARD ADV" }) as never,
				),
			).toBe("Expected a number between 0 and 120.");
		});
	});

	it("scoreCalcs jubility", () => {
		expect(
			JUBEAT_IMPL.scoreCalcs(scoreData, JUBEAT_IMPL.scoreDeriver(scoreData, chart), chart)
				.jubility,
		).toBe(63.7);
	});

	it.skip("Session Calcs", () => {
		// not ported from tap todo
	});

	it.skip("Profile Calcs", () => {
		// not ported from tap todo
	});

	describe("classDerivers", () => {
		const c = (
			v: number | null,
			expected: ReturnType<typeof JUBEAT_IMPL.classDerivers>["colour"],
		) => expect(JUBEAT_IMPL.classDerivers({ jubility: v }).colour).toBe(expected);

		it("maps jubility to colour", () => {
			c(null, null);
			c(0, "BLACK");
			c(9500, "GOLD");
			c(8500, "ORANGE");
			c(7000, "PINK");
			c(5500, "PURPLE");
			c(4000, "VIOLET");
			c(2500, "BLUE");
			c(1500, "LIGHT_BLUE");
			c(750, "GREEN");
			c(250, "YELLOW_GREEN");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("jubeat", chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "score", value: 1_008_182, mode: "single" }, "jubeat"),
			).toBe("Get a score of 1,008,182 on");
			expect(
				FormatGoalCriteria({ key: "musicRate", value: 93.1, mode: "single" }, "jubeat"),
			).toBe("Get a music rate of 93.1% on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.jubeat;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"jubeat">>,
				goalValue: integer,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "S", score: 927_342 }, GRADES.indexOf("S"), "SS-23K");
			f("score", { score: 982_123 }, 1_000_000, "982,123");
			f("lamp", { lamp: "CLEAR" }, LAMPS.indexOf("CLEAR"), "CLEAR");
			f("musicRate", { musicRate: 93.2 }, 94.4, "93.2%");
		});

		it("outOf", () => {
			const gConf = GetGameConfig("jubeat");
			const toFmt = (m: string) =>
				(GetScoreMetricConf(gConf, m) as { goalOutOfFormatter: (v: number) => string })
					.goalOutOfFormatter;
			expect(toFmt("score")(983_132)).toBe("983,132");
			expect(toFmt("musicRate")(99.1123)).toBe("99.1%");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedJubeatChart);

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: "jubeat_pb_lamp" });
			const main = mkMockScore("jubeat", chart, scoreData);

			const lampSd: ScoreData<"jubeat"> = {
				...scoreData,
				musicRate: 0,
				score: 0,
				lamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: LAMPS.indexOf("FULL COMBO"),
				},
			};

			await insertJubeatScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertJubeatScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

			const pb = await CreatePBDoc("jubeat", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Music Rate" },
					{ name: "Best Lamp", scoreID: "bestLamp" },
				],
				scoreData: {
					musicRate: scoreData.musicRate,
					score: scoreData.score,
					lamp: "FULL COMBO",
					enumIndexes: { lamp: LAMPS.indexOf("FULL COMBO") },
				},
			});
		});

		it("joins best score", async () => {
			const { id: userId } = await seedUser({ username: "jubeat_pb_score" });
			const main = mkMockScore("jubeat", chart, scoreData);

			const bestScoreSd: ScoreData<"jubeat"> = {
				...scoreData,
				musicRate: 0,
				score: 1_000_000,
				lamp: "FAILED",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: LAMPS.indexOf("FAILED"),
				},
			};

			await insertJubeatScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertJubeatScore({
				userId,
				scoreId: "bestScore",
				sd: bestScoreSd,
				timeMs: 2000,
			});

			const pb = await CreatePBDoc("jubeat", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Music Rate" },
					{ name: "Best Score", scoreID: "bestScore" },
				],
				scoreData: {
					musicRate: scoreData.musicRate,
					lamp: scoreData.lamp,
					score: 1_000_000,
				},
			});
		});
	});
});
