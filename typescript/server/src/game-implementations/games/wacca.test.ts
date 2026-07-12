import type { DeepPartial } from "#utils/types";

import { RunValidators } from "#game-implementations/games/_common";
import { WACCA_IMPL } from "#game-implementations/games/wacca";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingWaccaPupaExp, TestingWaccaPupaSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	type MongoProvidedMetrics,
	type ScoreData,
	type ScoreDocument,
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

const chart = TestingWaccaPupaExp;

const WACCA_CONF = GetGameConfig("wacca");
const GRADES = enumMetricValues(WACCA_CONF.derivedMetrics.grade);
const LAMPS = enumMetricValues(WACCA_CONF.providedMetrics.lamp);

const baseMetrics: MongoProvidedMetrics["wacca"] = {
	lamp: "CLEAR",
	score: 953_000,
};

const scoreData: ScoreData<"wacca"> = {
	lamp: "CLEAR",
	score: 953_000,
	grade: "SS",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: GRADES.indexOf("SS"),
		lamp: LAMPS.indexOf("CLEAR"),
	},
};

async function seedWaccaChart() {
	await DB.insertInto("song")
		.values({
			id: TestingWaccaPupaSong.id,
			legacy_id: 77,
			game_group: "wacca",
			title: TestingWaccaPupaSong.title,
			artist: TestingWaccaPupaSong.artist,
			search_terms: TestingWaccaPupaSong.searchTerms,
			alt_titles: TestingWaccaPupaSong.altTitles,
			data: TestingWaccaPupaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "wacca",
			song_id: TestingWaccaPupaSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertWaccaScore(opts: {
	scoreId: string;
	sd: ScoreData<"wacca">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("wacca", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "wacca",
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

describe("WACCA_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		const g = (score: number, expected: string) =>
			expect(
				WACCA_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never).grade,
			).toBe(expected);

		it("maps score to grade", () => {
			g(0, "D");
			g(1, "C");
			g(300_100, "B");
			g(700_000, "A");
			g(800_000, "AA");
			g(850_000, "AAA");
			g(900_000, "S");
			g(930_000, "S+");
			g(950_000, "SS");
			g(970_000, "SS+");
			g(980_000, "SSS");
			g(990_000, "SSS+");
			g(1_000_000, "MASTER");
		});
	});

	it("scoreCalcs rate", () => {
		expect(
			WACCA_IMPL.scoreCalcs(scoreData, WACCA_IMPL.scoreDeriver(scoreData, chart), chart).rate,
		).toBe(41.1);
	});

	describe("classDerivers", () => {
		const c = (
			v: number | null,
			expected: ReturnType<typeof WACCA_IMPL.classDerivers>["colour"],
		) => expect(WACCA_IMPL.classDerivers({ naiveRate: v }).colour).toBe(expected);

		it("maps rate to colour", () => {
			c(null, null);
			c(0, "ASH");
			c(2500, "RAINBOW");
			c(2200, "GOLD");
			c(1900, "SILVER");
			c(1600, "BLUE");
			c(1300, "PURPLE");
			c(1000, "RED");
			c(600, "YELLOW");
			c(300, "NAVY");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("wacca", chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "score", value: 908_182, mode: "single" }, "wacca"),
			).toBe("Get a score of 908,182 on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.wacca;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"wacca">>,
				goalValue: number,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "S", score: 917_342 }, GRADES.indexOf("SS"), "(S+)-13K");
			f("score", { score: 982_123 }, 1_000_000, "982,123");
			f("lamp", { lamp: "CLEAR" }, LAMPS.indexOf("CLEAR"), "CLEAR");
		});

		it("outOf", () => {
			const scoreMetric = GetScoreMetricConf(GetGameConfig("wacca"), "score") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(scoreMetric.goalOutOfFormatter(901_003)).toBe("901,003");
			expect(scoreMetric.goalOutOfFormatter(983_132)).toBe("983,132");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedWaccaChart);

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: "wacca_pb" });
			const main = mkMockScore("wacca", chart, scoreData);

			const lampSd: ScoreData<"wacca"> = {
				...scoreData,
				score: 0,
				lamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: LAMPS.indexOf("FULL COMBO"),
				},
			};

			await insertWaccaScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertWaccaScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

			const pb = await CreatePBDoc("wacca", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [{ name: "Best Score" }, { name: "Best Lamp", scoreID: "bestLamp" }],
				scoreData: {
					score: scoreData.score,
					lamp: "FULL COMBO",
				},
			});
		});
	});

	describe("scoreValidators", () => {
		const mockScore = mkMockScore("wacca", chart, scoreData);

		const run = (s: DeepPartial<ScoreDocument<"wacca">>) =>
			RunValidators(WACCA_IMPL.scoreValidators, dmf(mockScore, s) as never, chart as never);

		it("accepts valid scores", () => {
			expect(run({ scoreData: { lamp: "ALL MARVELOUS", score: 1_000_000 } })).toBeUndefined();
			expect(
				run({ scoreData: { lamp: "FULL COMBO", judgements: { miss: 0 } } }),
			).toBeUndefined();
		});

		it("rejects inconsistent lamps and judgements", () => {
			expect(run({ scoreData: { lamp: "ALL MARVELOUS", score: 999_999 } })).toEqual([
				"ALL MARVELOUS scores must have a perfect score. Got 999999 instead.",
			]);

			expect(
				run({
					scoreData: {
						lamp: "FULL COMBO",
						judgements: { miss: 1 },
					},
				}),
			).toEqual(["Cannot have a FULL COMBO with misses."]);

			expect(
				run({
					scoreData: {
						lamp: "ALL MARVELOUS",
						score: 1_000_000,
						judgements: { good: 1 },
					},
				}),
			).toEqual(["Cannot have an ALL MARVELOUS if all judgements were not marvelous."]);

			expect(
				run({
					scoreData: {
						lamp: "ALL MARVELOUS",
						score: 1_000_000,
						judgements: { great: 1 },
					},
				}),
			).toEqual(["Cannot have an ALL MARVELOUS if all judgements were not marvelous."]);

			expect(
				run({
					scoreData: {
						lamp: "ALL MARVELOUS",
						score: 1_000_000,
						judgements: { miss: 1 },
					},
				}),
			).toEqual(["Cannot have an ALL MARVELOUS if all judgements were not marvelous."]);
		});
	});
});
