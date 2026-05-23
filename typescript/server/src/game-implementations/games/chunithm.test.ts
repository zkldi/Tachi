import { CHUNITHM_IMPL } from "#game-implementations/games/chunithm";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { CHUNITHMBBKKChart, CHUNITHMBBKKSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	CHUNITHM_CLEAR_LAMPS,
	CHUNITHM_GRADES,
	CHUNITHM_NOTE_LAMPS,
	type MongoProvidedMetrics,
	type ScoreData,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const chart = CHUNITHMBBKKChart;

const baseMetrics: MongoProvidedMetrics["chunithm"] = {
	clearLamp: "CLEAR",
	noteLamp: "NONE",
	score: 1_003_000,
};

const scoreData: ScoreData<"chunithm"> = {
	clearLamp: "CLEAR",
	noteLamp: "NONE",
	score: 1_003_000,
	grade: "SS",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: CHUNITHM_GRADES.SS,
		clearLamp: CHUNITHM_CLEAR_LAMPS.CLEAR,
		noteLamp: CHUNITHM_NOTE_LAMPS.NONE,
	},
};

let profileChartCounter = 0;

async function seedChunithmChartsWithPbs(userId: number, ratings: Array<number>) {
	const start = profileChartCounter;

	await Promise.all(
		ratings.map(async (rating, i) => {
			const n = start + i + 1;
			const songId = `song-chuni-prof-${n}`;
			const chartId = `chart-chuni-prof-${n}`;

			await DB.insertInto("song")
				.values({
					id: songId,
					legacy_id: 80_000 + n,
					game_group: "chunithm",
					title: "P",
					artist: "A",
					search_terms: [],
					alt_titles: [],
					data: {},
					fts_document: "",
				})
				.execute();

			await DB.insertInto("chart")
				.values({
					id: chartId,
					legacy_id: chartId,
					game: "chunithm",
					song_id: songId,
					level: "12",
					level_num: 12,
					is_primary: true,
					difficulty: "MASTER",
					versions: [],
					data: {},
				})
				.execute();

			await DB.insertInto("pb")
				.values({
					user_id: userId,
					chart_id: chartId,
					lens: null,
					data: JSON.stringify({}),
					derived_data: JSON.stringify({}),
					calculated_data: JSON.stringify({ rating }),
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

	profileChartCounter += ratings.length;
}

async function seedBbkkChart() {
	await DB.insertInto("song")
		.values({
			id: CHUNITHMBBKKSong.id,
			legacy_id: 3,
			game_group: "chunithm",
			title: CHUNITHMBBKKSong.title,
			artist: CHUNITHMBBKKSong.artist,
			search_terms: CHUNITHMBBKKSong.searchTerms,
			alt_titles: CHUNITHMBBKKSong.altTitles,
			data: CHUNITHMBBKKSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "chunithm",
			song_id: CHUNITHMBBKKSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertChuniScore(opts: {
	scoreId: string;
	sd: ScoreData<"chunithm">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("chunithm", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "chunithm",
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

describe("CHUNITHM_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		const g = (score: number, expected: string) =>
			expect(
				CHUNITHM_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never)
					.grade,
			).toBe(expected);

		it("maps score to grade", () => {
			g(0, "D");
			g(500_000, "C");
			g(600_000, "B");
			g(700_000, "BB");
			g(800_000, "BBB");
			g(900_000, "A");
			g(925_000, "AA");
			g(950_000, "AAA");
			g(975_000, "S");
			g(990_000, "S+");
			g(1_000_000, "SS");
			g(1_005_000, "SS+");
			g(1_007_500, "SSS");
			g(1_009_000, "SSS+");
		});
	});

	it("scoreCalcs rating", () => {
		expect(
			CHUNITHM_IMPL.scoreCalcs(scoreData, CHUNITHM_IMPL.scoreDeriver(scoreData, chart), chart)
				.rating,
		).toBe(4.3);
	});

	describe("profileCalcs naiveRating", () => {
		it("handles floating-point mean of top 50", async () => {
			const { id: userId } = await seedUser({ username: "chuni_prof_fp" });
			await seedChunithmChartsWithPbs(userId, Array(50).fill(17.15));

			const res = await CHUNITHM_IMPL.profileCalcs("chunithm", userId);

			expect(res.naiveRating).toBe(17.15);
		});

		it("averages fewer than 50 PBs over 50", async () => {
			const { id: userId } = await seedUser({ username: "chuni_prof_short" });
			await seedChunithmChartsWithPbs(userId, [16, 16, 16, 16]);

			const res = await CHUNITHM_IMPL.profileCalcs("chunithm", userId);

			expect(res.naiveRating).toBe(1.28);
		});
	});

	describe("classDerivers (naiveRating → colour)", () => {
		const c = (
			v: number | null,
			expected: ReturnType<typeof CHUNITHM_IMPL.classDerivers>["colour"],
		) => expect(CHUNITHM_IMPL.classDerivers({ naiveRating: v }).colour).toBe(expected);

		it("maps rating tiers", () => {
			c(null, null);
			c(0, "BLUE");
			c(2, "GREEN");
			c(4, "ORANGE");
			c(7, "RED");
			c(10, "PURPLE");
			c(12, "COPPER");
			c(13.25, "SILVER");
			c(14.5, "GOLD");
			c(15.25, "PLATINUM");
			c(15.5, "PLATINUM_II");
			c(15.75, "PLATINUM_III");
			c(16, "RAINBOW");
			c(16.25, "RAINBOW_II");
			c(16.5, "RAINBOW_III");
			c(16.75, "RAINBOW_IV");
			c(17, "RAINBOW_EX_I");
			c(17.25, "RAINBOW_EX_II");
			c(17.5, "RAINBOW_EX_III");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("chunithm", chart, scoreData);

		it("formats criteria", () => {
			expect(CHUNITHM_IMPL.goalCriteriaFormatters.score(1_008_182)).toBe(
				"Get a score of 1,008,182 on",
			);
		});

		it("formats progress", () => {
			const f = (
				k: keyof typeof CHUNITHM_IMPL.goalProgressFormatters,
				modifant: Partial<ScoreData<"chunithm">>,
				goalValue: number,
				expected: string,
			) =>
				expect(
					CHUNITHM_IMPL.goalProgressFormatters[k](
						dmf(mockPB, { scoreData: modifant }) as never,
						goalValue,
					),
				).toBe(expected);

			f("grade", { grade: "S+", score: 997_342 }, CHUNITHM_GRADES.SS, "SS-2.7K");
			f("score", { score: 982_123 }, 1_000_000, "982,123");
			f("clearLamp", { clearLamp: "CLEAR" }, CHUNITHM_CLEAR_LAMPS.CLEAR, "CLEAR");
			f("noteLamp", { noteLamp: "FULL COMBO" }, CHUNITHM_NOTE_LAMPS.FULL_COMBO, "FULL COMBO");
		});

		it("formats out-of", () => {
			expect(CHUNITHM_IMPL.goalOutOfFormatters.score(1_001_003)).toBe("1,001,003");
			expect(CHUNITHM_IMPL.goalOutOfFormatters.score(983_132)).toBe("983,132");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedBbkkChart);

		it("joins best note and clear lamps", async () => {
			const { id: userId } = await seedUser({ username: "chuni_pb" });
			const main = mkMockScore("chunithm", chart, scoreData);

			const noteSd: ScoreData<"chunithm"> = {
				...scoreData,
				score: 0,
				noteLamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					noteLamp: CHUNITHM_NOTE_LAMPS.FULL_COMBO,
				},
			};

			const clearSd: ScoreData<"chunithm"> = {
				...scoreData,
				score: 0,
				clearLamp: "ABSOLUTE",
				enumIndexes: {
					...scoreData.enumIndexes,
					clearLamp: CHUNITHM_CLEAR_LAMPS.ABSOLUTE,
				},
			};

			await insertChuniScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertChuniScore({ userId, scoreId: "bestNoteLamp", sd: noteSd, timeMs: 2000 });
			await insertChuniScore({ userId, scoreId: "bestClearLamp", sd: clearSd, timeMs: 3000 });

			const pb = await CreatePBDoc("chunithm", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Score" },
					{ name: "Best Note Lamp", scoreID: "bestNoteLamp" },
					{ name: "Best Clear Lamp", scoreID: "bestClearLamp" },
				],
				scoreData: {
					score: scoreData.score,
					clearLamp: "ABSOLUTE",
					noteLamp: "FULL COMBO",
					enumIndexes: {
						clearLamp: CHUNITHM_CLEAR_LAMPS.ABSOLUTE,
						noteLamp: CHUNITHM_NOTE_LAMPS.FULL_COMBO,
					},
				},
			});
		});
	});
});
