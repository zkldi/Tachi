import { GITADORA_DORA_IMPL, GITADORA_GITA_IMPL } from "#game-implementations/games/gitadora";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingGitadoraChart, TestingGitadoraSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	GITADORA_GRADES,
	GITADORA_LAMPS,
	type MongoProvidedMetrics,
	type ScoreData,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const baseMetrics: MongoProvidedMetrics["gitadora-dora" | "gitadora-gita"] = {
	lamp: "CLEAR",
	percent: 45,
};

const scoreData: ScoreData<"gitadora-dora" | "gitadora-gita"> = {
	lamp: "CLEAR",
	percent: 96,
	grade: "SS",
	enumIndexes: {
		grade: GITADORA_GRADES.SS,
		lamp: GITADORA_LAMPS.CLEAR,
	},
	judgements: {},
	optional: { enumIndexes: {} },
};

async function seedGitadoraChart(game: "gitadora-dora" | "gitadora-gita") {
	const chart = dmf(TestingGitadoraChart, { game } as never);

	await DB.insertInto("song")
		.values({
			id: TestingGitadoraSong.id,
			legacy_id: 1,
			game_group: "gitadora",
			title: TestingGitadoraSong.title,
			artist: TestingGitadoraSong.artist,
			search_terms: TestingGitadoraSong.searchTerms,
			alt_titles: TestingGitadoraSong.altTitles,
			data: TestingGitadoraSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game,
			song_id: TestingGitadoraSong.id,
			difficulty: chart.difficulty,
			level: chart.level,
			level_num: chart.levelNum,
			is_primary: chart.isPrimary,
			versions: chart.versions,
			data: chart.data,
		})
		.execute();

	return chart;
}

async function insertGitadoraScore(opts: {
	chartId: string;
	game: "gitadora-dora" | "gitadora-gita";
	scoreId: string;
	sd: ScoreData<"gitadora-dora" | "gitadora-gita">;
	timeMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg(opts.game, opts.sd);
	const ts = UnixMillisecondsToISO8601(opts.timeMs);

	await DB.insertInto("score")
		.values({
			id: opts.scoreId,
			user_id: opts.userId,
			chart_id: opts.chartId,
			game: opts.game,
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

describe.each([
	["gitadora-dora", GITADORA_DORA_IMPL] as const,
	["gitadora-gita", GITADORA_GITA_IMPL] as const,
])("%s", (game, impl) => {
	const chart = dmf(TestingGitadoraChart, { game } as never);

	describe("scoreDeriver (grade)", () => {
		const g = (percent: number, expected: string) =>
			expect(
				impl.scoreDeriver(dmf(baseMetrics, { percent }) as never, chart as never).grade,
			).toBe(expected);

		it("maps percent to grade", () => {
			g(0, "C");
			g(62, "C");
			g(63, "B");
			g(73, "A");
			g(80, "S");
			g(94, "S");
			g(95, "SS");
			g(100, "MAX");
			g(62.99, "C");
			g(72.99, "B");
			g(79.99, "A");
			g(94.99, "S");
			g(99.99, "SS");
		});
	});

	it("scoreCalcs skill", () => {
		const sd = dmf(scoreData, { percent: 76.57 });
		expect(
			impl.scoreCalcs(sd, impl.scoreDeriver(sd, chart as never), chart as never).skill,
		).toBe(72.74);
	});

	describe("classDerivers (naiveSkill → colour)", () => {
		const c = (v: number | null, expected: ReturnType<typeof impl.classDerivers>["colour"]) =>
			expect(impl.classDerivers({ naiveSkill: v }).colour).toBe(expected);

		it("maps skill tiers", () => {
			c(null, null);
			c(1, "WHITE");
			c(999, "WHITE");
			c(1000, "ORANGE");
			c(2000, "YELLOW");
			c(3000, "GREEN");
			c(4000, "BLUE");
			c(5000, "PURPLE");
			c(6000, "RED");
			c(1500, "ORANGE_GRD");
			c(2500, "YELLOW_GRD");
			c(3500, "GREEN_GRD");
			c(4500, "BLUE_GRD");
			c(5500, "PURPLE_GRD");
			c(6500, "RED_GRD");
			c(7000, "BRONZE");
			c(7500, "SILVER");
			c(8000, "GOLD");
			c(8500, "RAINBOW");
		});
	});

	describe("goal formatters", () => {
		const mockPB = mkMockPB(game, chart, scoreData);

		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "percent", value: 28.194, mode: "single" }, game),
			).toBe("Get 28.19% on");
			expect(
				FormatGoalCriteria({ key: "percent", value: 28.195, mode: "single" }, game),
			).toBe("Get 28.20% on");
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS[game];
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<typeof game>>,
				goalValue: number,
				expected: string,
			) =>
				expect(fmt[k](dmf(mockPB, { scoreData: modifant }) as never, goalValue)).toBe(
					expected,
				);

			f("percent", { percent: 12.32 }, 30, "12.32%");
			f("grade", { grade: "SS", percent: 98.19 }, GITADORA_GRADES.MAX, "MAX-1.81%");
			f("lamp", { lamp: "CLEAR" }, GITADORA_LAMPS.CLEAR, "CLEAR");
		});

		it("outOf", () => {
			const percentMetric = GetScoreMetricConf(GetGameConfig(game), "percent") as {
				goalOutOfFormatter: (v: number) => string;
			};
			expect(percentMetric.goalOutOfFormatter(28.194)).toBe("28.19%");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		let chartRow: typeof chart;

		beforeEach(async () => {
			chartRow = await seedGitadoraChart(game);
		});

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: `gitadora_pb_${game}` });
			const main = mkMockScore(game, chartRow, scoreData);

			const lampSd: ScoreData<typeof game> = {
				...scoreData,
				percent: 0,
				lamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: GITADORA_LAMPS.FULL_COMBO,
				},
			};

			await insertGitadoraScore({
				userId,
				game,
				chartId: chartRow.chartID,
				scoreId: main.scoreID,
				sd: scoreData,
				timeMs: 1000,
			});

			await insertGitadoraScore({
				userId,
				game,
				chartId: chartRow.chartID,
				scoreId: "bestLamp",
				sd: lampSd,
				timeMs: 2000,
			});

			const pb = await CreatePBDoc(game, userId, chartRow, log);

			expect(pb).toMatchObject({
				composedFrom: [
					{ name: "Best Percent" },
					{ name: "Best Lamp", scoreID: "bestLamp" },
				],
				scoreData: {
					percent: scoreData.percent,
					lamp: "FULL COMBO",
					enumIndexes: { lamp: GITADORA_LAMPS.FULL_COMBO },
				},
			});
		});
	});
});
