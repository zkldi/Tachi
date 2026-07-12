import { MUSECA_IMPL } from "#game-implementations/games/museca";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingMusecaChart, TestingMusecaSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	type MongoProvidedMetrics,
	MUSECA_GRADES,
	MUSECA_LAMPS,
	type ScoreData,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const chart = TestingMusecaChart;

const baseMetrics: MongoProvidedMetrics["museca"] = {
	lamp: "CLEAR",
	score: 903_000,
};

const scoreData: ScoreData<"museca"> = {
	lamp: "CLEAR",
	score: 970_000,
	grade: "傑",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: MUSECA_GRADES.傑,
		lamp: MUSECA_LAMPS.CLEAR,
	},
};

async function seedMusecaChart() {
	await DB.insertInto("song")
		.values({
			id: TestingMusecaSong.id,
			legacy_id: 1,
			game_group: "museca",
			title: TestingMusecaSong.title,
			artist: TestingMusecaSong.artist,
			search_terms: TestingMusecaSong.searchTerms,
			alt_titles: TestingMusecaSong.altTitles,
			data: TestingMusecaSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game: "museca",
			song_id: TestingMusecaSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();
}

async function insertMusecaScore(opts: {
	scoreId: string;
	sd: ScoreData<"museca">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg("museca", opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: chart.chartID,
			game: "museca",
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

describe("MUSECA_IMPL", () => {
	describe("scoreDeriver (grade)", () => {
		const g = (score: number, expected: string) =>
			expect(
				MUSECA_IMPL.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never)
					.grade,
			).toBe(expected);

		it("maps score thresholds to kanji grades", () => {
			g(0, "没");
			g(600_000, "拙");
			g(700_000, "凡");
			g(800_000, "佳");
			g(850_000, "良");
			g(900_000, "優");
			g(950_000, "秀");
			g(975_000, "傑");
			g(1_000_000, "傑G");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB("museca", chart, scoreData);

		it("formats score criteria", () => {
			expect(
				FormatGoalCriteria({ key: "score", value: 908_182, mode: "single" }, "museca"),
			).toBe("Get a score of 908,182 on");
		});

		it("formats progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS.museca;
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<"museca">>,
				goalValue: number,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("grade", { grade: "傑", score: 997_342 }, MUSECA_GRADES.傑, "傑G-2.7K");
			f("score", { score: 982_123 }, 1_000_000, "982,123");
			f("lamp", { lamp: "CLEAR" }, MUSECA_LAMPS.CLEAR, "CLEAR");
		});

		it("formats out-of score", () => {
			const scoreMetric = GetScoreMetricConf(GetGameConfig("museca"), "score") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(scoreMetric.goalOutOfFormatter(901_003)).toBe("901,003");
			expect(scoreMetric.goalOutOfFormatter(983_132)).toBe("983,132");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(seedMusecaChart);

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: "museca_pb" });
			const main = mkMockScore("museca", chart, scoreData);

			const lampSd: ScoreData<"museca"> = {
				...scoreData,
				score: 0,
				lamp: "CONNECT ALL",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: MUSECA_LAMPS.CONNECT_ALL,
				},
			};

			await insertMusecaScore({ userId, scoreId: main.scoreID, sd: scoreData, timeMs: 1000 });
			await insertMusecaScore({ userId, scoreId: "bestLamp", sd: lampSd, timeMs: 2000 });

			const pb = await CreatePBDoc("museca", userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [{ name: "Best Score" }, { name: "Best Lamp", scoreID: "bestLamp" }],
				scoreData: {
					score: scoreData.score,
					lamp: "CONNECT ALL",
					enumIndexes: { lamp: MUSECA_LAMPS.CONNECT_ALL },
				},
			});
		});
	});
});
