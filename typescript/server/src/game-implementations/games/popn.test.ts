import { POPN_IMPL } from "#game-implementations/games/popn";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingPopnChart, TestingPopnSong } from "#test-utils/test-data";
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

const chart = TestingPopnChart;

const POPN_CONF = GetGameConfig("popn");
const GRADES = enumMetricValues(POPN_CONF.derivedMetrics.grade);
const LAMPS = enumMetricValues(POPN_CONF.derivedMetrics.lamp);
const CLEAR_MEDALS = enumMetricValues(POPN_CONF.providedMetrics.clearMedal);

const baseMetrics: MongoProvidedMetrics["popn"] = {
	clearMedal: "clearCircle",
	score: 93_001,
};

const scoreData: ScoreData<"popn"> = {
	lamp: "CLEAR",
	clearMedal: "clearCircle",
	score: 84_020,
	grade: "A",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: GRADES.indexOf("S"),
		lamp: LAMPS.indexOf("CLEAR"),
		clearMedal: CLEAR_MEDALS.indexOf("clearCircle"),
	},
};

async function seedPopnChart() {
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
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "popn",
			song_id: TestingPopnSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertPopnScore(opts: {
	scoreId: string;
	sd: ScoreData<"popn">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("popn", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "popn",
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

describe("POPN_IMPL", () => {
	describe("scoreDeriver", () => {
		it("maps score to grade", () => {
			const g = (score: number, expected: string) =>
				expect(
					POPN_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never)
						.grade,
				).toBe(expected);

			g(0, "E");
			g(50_000, "D");
			g(62_000, "C");
			g(72_000, "B");
			g(82_000, "A");
			g(90_000, "AA");
			g(95_000, "AAA");
			g(98_000, "S");
		});

		it("derives lamp from clear medal", () => {
			const lamp = (
				clearMedal: MongoProvidedMetrics["popn"]["clearMedal"],
				expected: string,
			) =>
				expect(
					POPN_IMPL.scoreDeriver(
						dmf(baseMetrics, { clearMedal }) as never,
						chart as never,
					).lamp,
				).toBe(expected);

			lamp("failedCircle", "FAILED");
			lamp("failedStar", "FAILED");
			lamp("failedDiamond", "FAILED");
			lamp("easyClear", "EASY CLEAR");
			lamp("clearCircle", "CLEAR");
			lamp("clearStar", "CLEAR");
			lamp("clearDiamond", "CLEAR");
			lamp("fullComboCircle", "FULL COMBO");
			lamp("fullComboStar", "FULL COMBO");
			lamp("fullComboDiamond", "FULL COMBO");
			lamp("perfect", "PERFECT");
		});
	});

	describe("classDerivers", () => {
		const cl = (
			v: number | null,
			expected: ReturnType<typeof POPN_IMPL.classDerivers>["class"],
		) => expect(POPN_IMPL.classDerivers({ naiveClassPoints: v }).class).toBe(expected);

		it("maps class points", () => {
			cl(null, null);
			cl(0, "KITTY");
			cl(21, "STUDENT");
			cl(34, "DELINQUENT");
			cl(46, "DETECTIVE");
			cl(59, "IDOL");
			cl(68, "GENERAL");
			cl(79, "HERMIT");
			cl(91, "GOD");
			cl(100, "GOD");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("popn", chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "score", value: 908_182, mode: "single" }, "popn"),
			).toBe("Get a score of 908,182 on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.popn;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"popn">>,
				goalValue: number,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "AAA", score: 95_342 }, GRADES.indexOf("S"), "S-2.7K");
			f("score", { score: 98_123 }, 100_000, "98,123");
			f("lamp", { lamp: "CLEAR" }, LAMPS.indexOf("CLEAR"), "CLEAR");
		});

		it("outOf", () => {
			const scoreMetric = GetScoreMetricConf(GetGameConfig("popn"), "score") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(scoreMetric.goalOutOfFormatter(901_003)).toBe("901,003");
			expect(scoreMetric.goalOutOfFormatter(983_132)).toBe("983,132");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedPopnChart);

		it("joins best clear medal", async () => {
			const { id: userId } = await seedUser({ username: "popn_pb" });
			const main = mkMockScore("popn", chart, scoreData);

			const medalSd: ScoreData<"popn"> = {
				...scoreData,
				clearMedal: "perfect",
				lamp: "PERFECT",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: LAMPS.indexOf("PERFECT"),
					clearMedal: CLEAR_MEDALS.indexOf("perfect"),
				},
			};

			await insertPopnScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertPopnScore({ userId, scoreId: "bestClearMedal", sd: medalSd, timeMs: 2000 });

			const pb = await CreatePBDoc("popn", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Score" },
					{ name: "Best Clear", scoreID: "bestClearMedal" },
				],
				scoreData: {
					score: scoreData.score,
					lamp: "PERFECT",
					clearMedal: "perfect",
				},
			});
		});
	});
});
