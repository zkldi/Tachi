/* eslint-disable  @typescript-eslint/no-explicit-any */

import { ONGEKI_IMPL } from "./ongeki";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { CreatePBDoc, UpdateChartRanking } from "lib/score-import/framework/pb/create-pb-doc";
import { ONGEKI_BELL_LAMPS, ONGEKI_GRADES, ONGEKI_NOTE_LAMPS } from "tachi-common";
import t from "tap";
import { dmf, mkMockPB, mkMockScore } from "test-utils/misc";
import ResetDBState from "test-utils/resets";
import { TestingOngekiChart, TestingOngekiScorePB } from "test-utils/test-data";
import type { PBScoreDocument, ProvidedMetrics, ScoreData } from "tachi-common";

const baseMetrics: ProvidedMetrics["ongeki:Single"] = {
	noteLamp: "CLEAR",
	bellLamp: "FULL BELL",
	score: 1_001_500,
	platinumScore: 970,
};

const scoreData: ScoreData<"ongeki:Single"> = {
	noteLamp: "CLEAR",
	bellLamp: "FULL BELL",
	score: 1_001_500,
	platinumScore: 970,
	platinumStars: 4,
	grade: "SSS",
	judgements: {},
	optional: { enumIndexes: {}, bellCount: 100 },
	enumIndexes: {
		grade: ONGEKI_GRADES.SSS,
		noteLamp: ONGEKI_NOTE_LAMPS.CLEAR,
		bellLamp: ONGEKI_BELL_LAMPS.FULL_BELL,
	},
};

const mockScore = mkMockScore("ongeki", "Single", TestingOngekiChart, scoreData);
const mockPB = mkMockPB("ongeki", "Single", TestingOngekiChart, scoreData);

const logger = CreateLogCtx(__filename);

t.test("ONGEKI Implementation", (t: any) => {
	t.test("Grade Deriver", (t: any) => {
		const f = (score: number, expected: string) =>
			t.equal(
				ONGEKI_IMPL.derivers.grade(dmf(baseMetrics, { score }), TestingOngekiChart),
				expected,
				`A score of ${score.toLocaleString()} should result in grade=${expected}.`
			);

		f(0, "D");
		f(500_000, "C");
		f(700_000, "B");
		f(750_000, "BB");
		f(800_000, "BBB");
		f(850_000, "A");
		f(900_000, "AA");
		f(940_000, "AAA");
		f(970_000, "S");
		f(990_000, "SS");
		f(1_000_000, "SSS");
		f(1_007_500, "SSS+");
		f(1_010_000, "SSS+");

		t.end();
	});

	t.test("Star Deriver", (t: any) => {
		const f = (platinumScore: number, expected: number) =>
			t.equal(
				ONGEKI_IMPL.derivers.platinumStars(
					dmf(baseMetrics, { platinumScore }),
					TestingOngekiChart
				),
				expected,
				`A score of ${platinumScore.toLocaleString()} should result in stars=${expected}.`
			);

		f(939, 0);
		f(940, 1);
		f(950, 2);
		f(960, 3);
		f(970, 4);
		f(980, 5);
		f(990, 6);
		f(1000, 6);

		t.end();
	});

	t.test("Rating Calc", (t: any) => {
		t.equal(
			ONGEKI_IMPL.scoreCalcs.rating(scoreData, TestingOngekiChart),
			12.1,
			"Basic classic rating check"
		);

		t.equal(
			ONGEKI_IMPL.scoreCalcs.scoreRating(scoreData, TestingOngekiChart),
			12.1,
			"Basic score rating check"
		);

		t.equal(
			ONGEKI_IMPL.scoreCalcs.starRating(scoreData, TestingOngekiChart),
			Math.floor(scoreData.platinumStars * (TestingOngekiChart.levelNum * 10) ** 2) /
				100000.0,
			"Basic star rating check"
		);

		t.end();
	});

	t.todo("Session Calcs");

	t.test("Profile Calcs", (t: any) => {
		t.beforeEach(ResetDBState);

		const mockPBs = async (
			ratings: Array<number>,
			field: "rating" | "scoreRating" | "starRating"
		) => {
			await Promise.all(
				ratings.map((rating, idx) => {
					const ratings =
						// Leave me and my ternaries alone
						// eslint-disable-next-line no-nested-ternary
						field === "rating"
							? { rating, scoreRating: 0, starRating: 0 }
							: field === "scoreRating"
							? { rating: 0, scoreRating: rating, starRating: 0 }
							: { rating: 0, scoreRating: 0, starRating: rating };

					return db["personal-bests"].insert({
						...TestingOngekiScorePB,
						chartID: `TEST${field}${idx}`,
						calculatedData: {
							...TestingOngekiScorePB.calculatedData,
							...ratings,
						},
					});
				})
			);
		};

		t.test("Floating-point edge case", async (t: any) => {
			await mockPBs(Array(45).fill(16.27), "rating");
			await mockPBs(Array(60).fill(16.271), "scoreRating");

			t.equal(await ONGEKI_IMPL.profileCalcs.naiveRating("ongeki", "Single", 1), 16.27);
			t.equal(
				await ONGEKI_IMPL.profileCalcs.naiveRatingRefresh("ongeki", "Single", 1),
				19.525
			);

			await mockPBs([1, 1, 0, 0], "starRating");

			t.equal(
				await ONGEKI_IMPL.profileCalcs.naiveRatingRefresh("ongeki", "Single", 1),
				19.565
			);

			t.end();
		});

		t.test("Profile with few scores #1", async (t: any) => {
			await mockPBs([16, 16, 16, 16], "rating");
			await mockPBs([16, 16, 16, 16], "scoreRating");

			t.equal(await ONGEKI_IMPL.profileCalcs.naiveRating("ongeki", "Single", 1), 1.42);
			t.equal(
				await ONGEKI_IMPL.profileCalcs.naiveRatingRefresh("ongeki", "Single", 1),
				1.279
			);

			await mockPBs([1, 1, 0, 0], "starRating");

			t.equal(
				await ONGEKI_IMPL.profileCalcs.naiveRatingRefresh("ongeki", "Single", 1),
				1.319
			);

			t.end();
		});

		t.test("Profile with few scores #2", async (t: any) => {
			await mockPBs([1, 1, 0, 0], "starRating");

			t.equal(await ONGEKI_IMPL.profileCalcs.naiveRatingRefresh("ongeki", "Single", 1), 0.04);

			t.end();
		});

		t.end();
	});

	t.test("Colour Deriver", (t: any) => {
		const f = (v: number | null, expected: string | null) =>
			t.equal(
				ONGEKI_IMPL.classDerivers.colour({ naiveRatingRefresh: v }),
				expected,
				`A naiveRatingRefresh of ${v} should result in ${expected}.`
			);

		f(null, null);
		f(0, "BLUE");
		f(4, "GREEN");
		f(7, "ORANGE");
		f(9, "RED");
		f(11, "PURPLE");
		f(13, "COPPER");
		f(15, "SILVER");
		f(17, "GOLD");
		f(18, "PLATINUM");
		f(19, "RAINBOW");
		f(20, "RAINBOW_SHINY");
		f(21, "RAINBOW_EX");
		f(22, "RAINBOW_EX_TRUE");
		f(23, "RAINBOW_EX_TRUE");

		t.end();
	});

	t.test("Goal Formatters", (t: any) => {
		t.test("Criteria", (t: any) => {
			t.equal(
				ONGEKI_IMPL.goalCriteriaFormatters.score(1_008_182),
				"Get a score of 1,008,182 on"
			);

			t.equal(
				ONGEKI_IMPL.goalCriteriaFormatters.platinumScore(1500),
				"Get 1,500 Platinum Score on"
			);

			t.equal(ONGEKI_IMPL.goalCriteriaFormatters.platinumStars(3), "Get ★★★☆☆ on");

			t.end();
		});

		t.test("Progress", (t: any) => {
			const f = (
				k: keyof typeof ONGEKI_IMPL.goalProgressFormatters,
				modifant: Partial<ScoreData<"ongeki:Single">>,
				goalValue: any,
				expected: any
			) =>
				t.equal(
					ONGEKI_IMPL.goalProgressFormatters[k](
						dmf(mockPB, {
							scoreData: modifant,
						}),
						goalValue
					),
					expected
				);

			f("grade", { grade: "S", score: 987_342 }, ONGEKI_GRADES.S, "SS-2.7K");
			f("noteLamp", { noteLamp: "CLEAR" }, ONGEKI_NOTE_LAMPS.CLEAR, "CLEAR");
			f("bellLamp", { bellLamp: "FULL BELL" }, ONGEKI_BELL_LAMPS.FULL_BELL, "FULL BELL");
			f("score", { score: 982_123 }, 1_000_000, "982,123");
			f("platinumScore", { platinumScore: 1234 }, 2345, "1,234");

			t.end();
		});

		t.test("Out Of", (t: any) => {
			t.equal(ONGEKI_IMPL.goalOutOfFormatters.score(1_001_003), "1,001,003");
			t.equal(ONGEKI_IMPL.goalOutOfFormatters.score(983_132), "983,132");
			t.equal(ONGEKI_IMPL.goalOutOfFormatters.platinumScore(1234), "1,234");

			t.end();
		});

		t.end();
	});

	t.test("PB Merging", (t: any) => {
		t.beforeEach(ResetDBState);

		t.test("Should join best lamp", async (t: any) => {
			await db.scores.insert(mockScore);
			await db.scores.insert(
				dmf(mockScore, {
					scoreID: "bestLamp",
					scoreData: {
						score: 0,
						noteLamp: "FULL COMBO",
						enumIndexes: { noteLamp: ONGEKI_NOTE_LAMPS.FULL_COMBO },
					},
				})
			);

			t.hasStrict(await CreatePBDoc("ongeki:Single", 1, TestingOngekiChart, logger), {
				composedFrom: [
					{ name: "Best Score" },
					{ name: "Best Note Lamp", scoreID: "bestLamp" },
				],
				scoreData: {
					score: mockScore.scoreData.score,
					noteLamp: "FULL COMBO",
					bellLamp: "FULL BELL",
					enumIndexes: {
						noteLamp: ONGEKI_NOTE_LAMPS.FULL_COMBO,
						bellLamp: ONGEKI_BELL_LAMPS.FULL_BELL,
					},
				},
			});

			t.end();
		});

		t.test("Should join platinum score", async (t: any) => {
			await db.scores.insert(mockScore);
			await db.scores.insert(
				dmf(mockScore, {
					scoreID: "bestPlatinum",
					scoreData: {
						score: 0,
						platinumScore: 990,
						platinumStars: 6,
					},
				})
			);

			t.hasStrict(await CreatePBDoc("ongeki:Single", 1, TestingOngekiChart, logger), {
				composedFrom: [
					{ name: "Best Score" },
					{ name: "Best Platinum Score", scoreID: "bestPlatinum" },
				],
				scoreData: {
					score: mockScore.scoreData.score,
					platinumScore: 990,
					platinumStars: 6,
				},
			});

			t.end();
		});

		t.end();
	});

	t.test("Ranking", (t: any) => {
		t.beforeEach(ResetDBState);

		t.test("Should tiebreak according to platinum score", async (t: any) => {
			await db["personal-bests"].insert({
				...TestingOngekiScorePB,
				scoreData: {
					...TestingOngekiScorePB.scoreData,
					platinumScore: 1000,
				},
				timeAchieved: 3,
				userID: 1,
			});

			await db["personal-bests"].insert({
				...TestingOngekiScorePB,
				scoreData: {
					...TestingOngekiScorePB.scoreData,
					platinumScore: 1001,
				},
				timeAchieved: 2,
				userID: 2,
			});

			await db["personal-bests"].insert({
				...TestingOngekiScorePB,
				scoreData: {
					...TestingOngekiScorePB.scoreData,
					platinumScore: 999,
				},
				timeAchieved: 1,
				userID: 3,
			});

			await UpdateChartRanking("ongeki", "Single", TestingOngekiChart.chartID);

			const pbs = (await db["personal-bests"].find({
				chartID: TestingOngekiChart.chartID,
			})) as Array<PBScoreDocument<"ongeki:Single">>;

			t.strictSame(pbs.length, 3);

			for (const pb of pbs) {
				t.strictSame(pb.rankingData.outOf, 3);
				if (pb.scoreData.platinumScore === 999) {
					t.strictSame(pb.rankingData.rank, 3);
				} else if (pb.scoreData.platinumScore === 1000) {
					t.strictSame(pb.rankingData.rank, 2);
				} else {
					t.strictSame(pb.rankingData.rank, 1);
				}
			}

			t.end();
		});

		t.test("Should not tiebreak if tech scores differ", async (t: any) => {
			await db["personal-bests"].insert({
				...TestingOngekiScorePB,
				scoreData: {
					...TestingOngekiScorePB.scoreData,
					score: 1010000,
					platinumScore: 0,
				},
				userID: 1,
			});

			await db["personal-bests"].insert({
				...TestingOngekiScorePB,
				scoreData: {
					...TestingOngekiScorePB.scoreData,
					score: 1009999,
					platinumScore: 1001,
				},
				userID: 2,
			});

			await UpdateChartRanking("ongeki", "Single", TestingOngekiChart.chartID);

			const [pb1, pb2] = (await db["personal-bests"].find(
				{
					chartID: TestingOngekiChart.chartID,
				},
				{
					sort: {
						[`rankingData.rank`]: 1,
					},
				}
			)) as Array<PBScoreDocument<"ongeki:Single">>;

			t.strictSame(pb1?.rankingData.outOf, 2);
			t.strictSame(pb1?.rankingData.rank, 1);
			t.strictSame(pb2?.rankingData.rank, 2);
			t.strictSame(pb1?.scoreData.platinumScore, 0);
			t.strictSame(pb2?.scoreData.platinumScore, 1001);

			t.end();
		});

		t.end();
	});

	t.end();
});
