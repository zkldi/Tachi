import type { DeepPartial } from "#utils/types";

import { RunValidators } from "#game-implementations/games/_common";
import { ARCAEA_IMPL } from "#game-implementations/games/arcaea";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingArcaeaSheriruthFTR, TestingArcaeaSheriruthPST, TestingArcaeaSheriruthSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	ARCAEA_GRADES,
	ARCAEA_LAMPS,
	type MongoProvidedMetrics,
	type ScoreData,
	type ScoreDocument,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const chart = TestingArcaeaSheriruthFTR;
const chartWithoutNotecount = TestingArcaeaSheriruthPST;

const baseMetrics: MongoProvidedMetrics["arcaea"] = {
	lamp: "CLEAR",
	score: 9_979_366,
};

const scoreData: ScoreData<"arcaea"> = {
	lamp: "CLEAR",
	score: 9_979_366,
	grade: "EX+",
	judgements: {
		pure: 1148,
		far: 1,
		lost: 2,
	},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: ARCAEA_GRADES.EX_PLUS,
		lamp: ARCAEA_LAMPS.CLEAR,
	},
};

async function seedSheriruthChart() {
	await DB.insertInto("song")
		.values({
			id: TestingArcaeaSheriruthSong.id,
			legacy_id: 19,
			game_group: "arcaea",
			title: TestingArcaeaSheriruthSong.title,
			artist: TestingArcaeaSheriruthSong.artist,
			search_terms: TestingArcaeaSheriruthSong.searchTerms,
			alt_titles: TestingArcaeaSheriruthSong.altTitles,
			data: TestingArcaeaSheriruthSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "arcaea",
			song_id: TestingArcaeaSheriruthSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertArcaeaScoreRow(opts: {
	scoreData: ScoreData<"arcaea">;
	scoreId: string;
	timeAchievedMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("arcaea", opts.scoreData);
	const t = UnixMillisecondsToISO8601(opts.timeAchievedMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "arcaea",
			session_id: null,
			import_id: null,
			data: JSON.stringify(data),
			derived_data: JSON.stringify(derived),
			judgements: JSON.stringify(judgements),
			calculated_data: JSON.stringify({}),
			meta: JSON.stringify({}),
			time_achieved: t,
			time_added: t,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe("ARCAEA_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		const g = (score: number, expected: string) =>
			expect(
				ARCAEA_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never)
					.grade,
			).toBe(expected);

		it("maps score thresholds to letter grades", () => {
			g(0, "D");
			g(8_600_000, "C");
			g(8_900_000, "B");
			g(9_200_000, "A");
			g(9_500_000, "AA");
			g(9_800_000, "EX");
			g(9_900_000, "EX+");
		});
	});

	it("scoreCalcs potential", () => {
		expect(
			ARCAEA_IMPL.scoreCalcs(scoreData, ARCAEA_IMPL.scoreDeriver(scoreData, chart), chart)
				.potential,
		).toBe(11.99);
	});

	describe("classDerivers (naivePotential → badge)", () => {
		const badge = (
			v: number | null,
			expected: ReturnType<typeof ARCAEA_IMPL.classDerivers>["badge"],
		) => expect(ARCAEA_IMPL.classDerivers({ naivePotential: v }).badge).toBe(expected);

		it("maps potential tiers to badge colours", () => {
			badge(null, null);
			badge(0, "BLUE");
			badge(3.5, "GREEN");
			badge(7, "ASH_PURPLE");
			badge(10, "PURPLE");
			badge(11, "RED");
			badge(12, "ONE_STAR");
			badge(12.5, "TWO_STARS");
			badge(13, "THREE_STARS");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("arcaea", chart, scoreData);

		it("formats score criteria", () => {
			expect(ARCAEA_IMPL.goalCriteriaFormatters.score(10_002_221)).toBe(
				"Get a score of 10,002,221 on",
			);
		});

		it("formats progress for grade, score, and lamp", () => {
			const f = (
				k: keyof typeof ARCAEA_IMPL.goalProgressFormatters,
				modifant: Partial<ScoreData<"arcaea">>,
				goalValue: number,
				expected: string,
			) =>
				expect(
					ARCAEA_IMPL.goalProgressFormatters[k](
						dmf(mockPB, { scoreData: modifant }) as never,
						goalValue,
					),
				).toBe(expected);

			f("grade", { grade: "EX", score: 9_897_342 }, ARCAEA_GRADES.EX_PLUS, "(EX+)-2.7K");
			f("score", { score: 9_982_123 }, 10_000_000, "9,982,123");
			f("lamp", { lamp: "CLEAR" }, ARCAEA_LAMPS.CLEAR, "CLEAR");
		});

		it("formats out-of score", () => {
			expect(ARCAEA_IMPL.goalOutOfFormatters.score(10_001_003)).toBe("10,001,003");
			expect(ARCAEA_IMPL.goalOutOfFormatters.score(9_983_132)).toBe("9,983,132");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedSheriruthChart);

		it("joins best lamp into the default-metric PB", async () => {
			const { id: userId } = await seedUser({ username: "arcaea_pb_lamp" });
			const main = mkMockScore("arcaea", chart, scoreData);

			const lampScoreData: ScoreData<"arcaea"> = {
				...scoreData,
				score: 0,
				lamp: "FULL RECALL",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: ARCAEA_LAMPS.FULL_RECALL,
				},
			};

			await insertArcaeaScoreRow({
				userId,
				scoreId: main.scoreID,
				scoreData,
				timeAchievedMs: 1_000,
			});

			await insertArcaeaScoreRow({
				userId,
				scoreId: "bestLamp",
				scoreData: lampScoreData,
				timeAchievedMs: 2_000,
			});

			const pb = await CreatePBDoc("arcaea", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [{ name: "Best Score" }, { name: "Best Lamp", scoreID: "bestLamp" }],
				scoreData: {
					score: scoreData.score,
					lamp: "FULL RECALL",
					enumIndexes: { lamp: ARCAEA_LAMPS.FULL_RECALL },
				},
			});
		});
	});

	describe("scoreValidators & chartSpecificValidators", () => {
		const mockScore = mkMockScore("arcaea", chart, scoreData);

		const runVal = (s: DeepPartial<ScoreDocument<"arcaea">>) =>
			RunValidators(ARCAEA_IMPL.scoreValidators, dmf(mockScore, s) as never, chart as never);

		it("accepts valid PM, FR, and chart score bounds", () => {
			expect(
				runVal({
					scoreData: {
						lamp: "PURE MEMORY",
						score: 10_001_151,
						judgements: {
							pure: 1151,
							far: 0,
							lost: 0,
						},
					},
				}),
			).toBeUndefined();

			expect(
				runVal({ scoreData: { lamp: "FULL RECALL", judgements: { lost: 0 } } }),
			).toBeUndefined();

			expect(
				ARCAEA_IMPL.chartSpecificValidators.score(mockScore.scoreData.score, chart),
			).toBe(true);
		});

		it("rejects inconsistent lamps and judgements", () => {
			expect(
				runVal({
					scoreData: {
						lamp: "PURE MEMORY",
						score: 9_999_999,
						judgements: { pure: 1151, far: 0, lost: 0 },
					},
				}),
			).toEqual([
				"PURE MEMORY scores must have a score larger than 10 million. Got 9999999 instead.",
			]);

			expect(
				runVal({
					scoreData: {
						lamp: "FULL RECALL",
						score: 4_999_999,
						judgements: { pure: 500, far: 500, lost: 0 },
					},
				}),
			).toEqual([
				"FULL RECALL scores must have a score larger than 5 million. Got 4999999 instead.",
			]);

			expect(
				runVal({
					scoreData: {
						lamp: "FULL RECALL",
						score: 8_000_000,
						judgements: { pure: 800, far: 0, lost: 1 },
					},
				}),
			).toEqual(["Cannot have a FULL RECALL with non-zero lost count."]);

			expect(
				runVal({
					scoreData: {
						lamp: "PURE MEMORY",
						score: 10_001_151,
						judgements: { pure: 1150, far: 1, lost: 0 },
					},
				}),
			).toEqual(["Cannot have a PURE MEMORY with any fars or losts."]);

			expect(
				runVal({
					scoreData: {
						lamp: "PURE MEMORY",
						score: 10_001_151,
						judgements: { pure: 1150, far: 0, lost: 1 },
					},
				}),
			).toEqual(["Cannot have a PURE MEMORY with any fars or losts."]);
		});

		it("rejects out-of-range chart scores", () => {
			expect(ARCAEA_IMPL.chartSpecificValidators.score(-1, chart)).toBe(
				"Score must be non-negative. Got -1",
			);

			expect(ARCAEA_IMPL.chartSpecificValidators.score(10_001_152, chart)).toBe(
				`Score cannot exceed ${10_000_000 + (chart.data.notecount ?? 0)} for this chart.`,
			);

			expect(ARCAEA_IMPL.chartSpecificValidators.score(10_001_152, chartWithoutNotecount)).toBe(
				true
			);
		});
	});
});
