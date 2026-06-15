import { ONGEKI_IMPL } from "#game-implementations/games/ongeki";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingOngekiChart, TestingOngekiScorePB, TestingOngekiSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	type MongoProvidedMetrics,
	ONGEKI_BELL_LAMPS,
	ONGEKI_GRADES,
	ONGEKI_NOTE_LAMPS,
	ONGEKI_PLATINUM_STARS,
	type ScoreData,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const chart = TestingOngekiChart;

const baseMetrics: MongoProvidedMetrics["ongeki"] = {
	noteLamp: "CLEAR",
	bellLamp: "FULL BELL",
	score: 1_001_500,
	platinumScore: 970,
};

const scoreData: ScoreData<"ongeki"> = {
	noteLamp: "CLEAR",
	bellLamp: "FULL BELL",
	score: 1_001_500,
	platinumScore: 970,
	platinumStars: "4-star",
	grade: "SSS",
	judgements: {},
	optional: { enumIndexes: {}, bellCount: 100 },
	enumIndexes: {
		grade: ONGEKI_GRADES.SSS,
		noteLamp: ONGEKI_NOTE_LAMPS.CLEAR,
		bellLamp: ONGEKI_BELL_LAMPS.FULL_BELL,
		platinumStars: ONGEKI_PLATINUM_STARS.FOUR_STAR,
	},
};

let ongekiProfileCounter = 0;

async function seedOngekiChartFixture() {
	await DB.insertInto("song")
		.values({
			id: TestingOngekiSong.id,
			legacy_id: 1,
			game_group: "ongeki",
			title: TestingOngekiSong.title,
			artist: TestingOngekiSong.artist,
			search_terms: TestingOngekiSong.searchTerms,
			alt_titles: TestingOngekiSong.altTitles,
			data: TestingOngekiSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "ongeki",
			song_id: TestingOngekiSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertOngekiScore(opts: {
	scoreId: string;
	sd: ScoreData<"ongeki">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("ongeki", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "ongeki",
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

async function seedOngekiProfilePbs(
	userId: number,
	ratings: Array<number>,
	field: "rating" | "scoreRating" | "starRating",
): Promise<void> {
	await Promise.all(
		ratings.map(async (rating, idx) => {
			const n = ++ongekiProfileCounter;
			const songId = `ongeki-pc-song-${field}-${n}`;
			const chartId = `ongeki-pc-chart-${field}-${n}`;

			const mergedCalcs = {
				...TestingOngekiScorePB.calculatedData,
				...(field === "rating"
					? { rating, scoreRating: 0, starRating: 0 }
					: field === "scoreRating"
						? { rating: 0, scoreRating: rating, starRating: 0 }
						: { rating: 0, scoreRating: 0, starRating: rating }),
			};

			await DB.insertInto("song")
				.values({
					id: songId,
					legacy_id: n,
					game_group: "ongeki",
					title: "T",
					artist: "A",
					search_terms: [],
					alt_titles: [],
					data: JSON.stringify({}),
					fts_document: "",
				})
				.execute();

			await DB.insertInto("chart")
				.values({
					id: chartId,
					legacy_id: chartId,
					game: "ongeki",
					song_id: songId,
					level: chart.level,
					level_num: chart.levelNum,
					is_primary: true,
					difficulty: chart.difficulty,
					versions: chart.versions,
					data: chart.data,
				})
				.execute();

			await DB.insertInto("pb")
				.values({
					user_id: userId,
					chart_id: chartId,
					lens: null,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					calculated_data: JSON.stringify(mergedCalcs),
					judgements: JSON.stringify({}),
					ranking_value: rating,
					ranking_value_tb1: null,
					ranking_value_tb2: null,
					ranking_value_tb3: null,
					ranking_value_tb4: null,
					ranking_value_tb5: null,
					highlight: false,
					time_achieved: null,
				})
				.execute();
		}),
	);
}

describe("ONGEKI_IMPL", () => {
	describe("scoreDeriver", () => {
		it("maps score to grade", () => {
			const g = (score: number, expected: string) =>
				expect(
					ONGEKI_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never)
						.grade,
				).toBe(expected);

			g(0, "D");
			g(500_000, "C");
			g(700_000, "B");
			g(750_000, "BB");
			g(800_000, "BBB");
			g(850_000, "A");
			g(900_000, "AA");
			g(940_000, "AAA");
			g(970_000, "S");
			g(990_000, "SS");
			g(1_000_000, "SSS");
			g(1_007_500, "SSS+");
			g(1_010_000, "SSS+");
		});

		it("maps platinum score to stars", () => {
			const f = (platinumScore: number, expected: string) =>
				expect(
					ONGEKI_IMPL.scoreDeriver(
						dmf(baseMetrics, { platinumScore }) as never,
						chart as never,
					).platinumStars,
				).toBe(expected);

			f(939, "0-star");
			f(940, "1-star");
			f(950, "2-star");
			f(960, "3-star");
			f(970, "4-star");
			f(980, "5-star");
			f(990, "R-star");
			f(1000, "R-star");
		});
	});

	it("scoreCalcs rating, scoreRating, starRating", () => {
		const derived = ONGEKI_IMPL.scoreDeriver(scoreData, chart);
		const calcs = ONGEKI_IMPL.scoreCalcs(scoreData, derived, chart);

		expect(calcs.rating).toBe(12.1);
		expect(calcs.scoreRating).toBe(12.1);
		expect(calcs.starRating).toBe(Math.floor(4 * (chart.levelNum * 10) ** 2) / 100000.0);
	});

	it.skip("Session Calcs", () => {
		// not ported from tap todo
	});

	describe("profileCalcs (Postgres pb.calculated_data)", () => {
		it("floating-point edge case", async () => {
			const { id: userId } = await seedUser({ username: "ongeki_prof_fp" });
			await seedOngekiProfilePbs(userId, Array(45).fill(16.27), "rating");
			await seedOngekiProfilePbs(userId, Array(60).fill(16.271), "scoreRating");

			const a = await ONGEKI_IMPL.profileCalcs("ongeki", userId);
			expect(a.naiveRating).toBe(16.27);
			expect(a.naiveRatingRefresh).toBe(19.525);

			await seedOngekiProfilePbs(userId, [1, 1, 0, 0], "starRating");

			const b = await ONGEKI_IMPL.profileCalcs("ongeki", userId);
			expect(b.naiveRatingRefresh).toBe(19.565);
		});

		it("profile with few scores #1", async () => {
			const { id: userId } = await seedUser({ username: "ongeki_prof_few1" });
			await seedOngekiProfilePbs(userId, [16, 16, 16, 16], "rating");
			await seedOngekiProfilePbs(userId, [16, 16, 16, 16], "scoreRating");

			const a = await ONGEKI_IMPL.profileCalcs("ongeki", userId);
			expect(a.naiveRating).toBe(1.42);
			expect(a.naiveRatingRefresh).toBe(1.279);

			await seedOngekiProfilePbs(userId, [1, 1, 0, 0], "starRating");

			const b = await ONGEKI_IMPL.profileCalcs("ongeki", userId);
			expect(b.naiveRatingRefresh).toBe(1.319);
		});

		it("profile with few scores #2", async () => {
			const { id: userId } = await seedUser({ username: "ongeki_prof_few2" });
			await seedOngekiProfilePbs(userId, [1, 1, 0, 0], "starRating");

			const a = await ONGEKI_IMPL.profileCalcs("ongeki", userId);
			expect(a.naiveRatingRefresh).toBe(0.04);
		});
	});

	describe("classDerivers", () => {
		const c = (v: number | null, expected: string | null) =>
			expect(ONGEKI_IMPL.classDerivers({ naiveRatingRefresh: v }).colour).toBe(expected);

		it("maps naiveRatingRefresh to colour", () => {
			c(null, null);
			c(0, "BLUE");
			c(4, "GREEN");
			c(7, "ORANGE");
			c(9, "RED");
			c(11, "PURPLE");
			c(13, "COPPER");
			c(15, "SILVER");
			c(17, "GOLD");
			c(18, "PLATINUM");
			c(19, "RAINBOW");
			c(20, "RAINBOW_SHINY");
			c(21, "RAINBOW_EX");
			c(22, "RAINBOW_EX_TRUE");
			c(23, "RAINBOW_EX_TRUE");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("ongeki", chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "score", value: 1_008_182, mode: "single" }, "ongeki"),
			).toBe("Get a score of 1,008,182 on");
			expect(
				FormatGoalCriteria({ key: "platinumScore", value: 1500, mode: "single" }, "ongeki"),
			).toBe("Get 1,500 Platinum Score on");
			// "3-star" is at index 3 in the platinumStars enum values
			expect(
				FormatGoalCriteria({ key: "platinumStars", value: 3, mode: "single" }, "ongeki"),
			).toBe("Get ★★★☆☆ on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.ongeki;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"ongeki">>,
				goalValue: number,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "S", score: 987_342 }, ONGEKI_GRADES.S, "SS-2.7K");
			f("noteLamp", { noteLamp: "CLEAR" }, ONGEKI_NOTE_LAMPS.CLEAR, "CLEAR");
			f("bellLamp", { bellLamp: "FULL BELL" }, ONGEKI_BELL_LAMPS.FULL_BELL, "FULL BELL");
			f("score", { score: 982_123 }, 1_000_000, "982,123");
			f("platinumScore", { platinumScore: 1234 }, 2345, "1,234");
		});

		it("outOf", () => {
			const gConf = GetGameConfig("ongeki");
			const toFmt = (m: string) =>
				(GetScoreMetricConf(gConf, m) as { goalOutOfFormatter: (v: number) => string })
					.goalOutOfFormatter;
			expect(toFmt("score")(1_001_003)).toBe("1,001,003");
			expect(toFmt("score")(983_132)).toBe("983,132");
			expect(toFmt("platinumScore")(1234)).toBe("1,234");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedOngekiChartFixture);

		it("joins best note lamp", async () => {
			const { id: userId } = await seedUser({ username: "ongeki_pb_lamp" });
			const main = mkMockScore("ongeki", chart, scoreData);

			const lampSd: ScoreData<"ongeki"> = {
				...scoreData,
				score: 0,
				noteLamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					noteLamp: ONGEKI_NOTE_LAMPS.FULL_COMBO,
				},
			};

			await insertOngekiScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertOngekiScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

			const pb = await CreatePBDoc("ongeki", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Score" },
					{ name: "Best Note Lamp", scoreID: "bestLamp" },
				],
				scoreData: {
					score: scoreData.score,
					noteLamp: "FULL COMBO",
					bellLamp: "FULL BELL",
					enumIndexes: {
						noteLamp: ONGEKI_NOTE_LAMPS.FULL_COMBO,
						bellLamp: ONGEKI_BELL_LAMPS.FULL_BELL,
						platinumStars: ONGEKI_PLATINUM_STARS.FOUR_STAR,
					},
				},
			});
		});

		it("joins best platinum score", async () => {
			const { id: userId } = await seedUser({ username: "ongeki_pb_plat" });
			const main = mkMockScore("ongeki", chart, scoreData);

			const platSd: ScoreData<"ongeki"> = {
				...scoreData,
				score: 0,
				platinumScore: 990,
				platinumStars: "R-star",
			};

			await insertOngekiScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertOngekiScore({ userId, scoreId: "bestPlatinum", sd: platSd, timeMs: 2000 });

			const pb = await CreatePBDoc("ongeki", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Score" },
					{ name: "Best Platinum Score", scoreID: "bestPlatinum" },
				],
				scoreData: {
					score: scoreData.score,
					platinumScore: 990,
					platinumStars: "R-star",
				},
			});
		});
	});
});
