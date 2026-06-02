import { USC_CONTROLLER_IMPL, USC_KEYBOARD_IMPL } from "#game-implementations/games/usc";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { TestingUSCChart, TestingUSCSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { type MongoProvidedMetrics, type ScoreData, SDVX_GRADES, USC_LAMPS } from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const baseMetrics: MongoProvidedMetrics["usc-controller" | "usc-keyboard"] = {
	lamp: "CLEAR",
	score: 9_003_000,
};

const scoreData: ScoreData<"usc-controller" | "usc-keyboard"> = {
	lamp: "CLEAR",
	score: 9_700_000,
	grade: "AAA",
	judgements: {},
	optional: { enumIndexes: {} },
	enumIndexes: {
		grade: SDVX_GRADES.AAA,
		lamp: USC_LAMPS.CLEAR,
	},
};

async function seedUscSongAndChart(game: "usc-controller" | "usc-keyboard") {
	const chart = dmf(TestingUSCChart, { game } as never);

	await DB.insertInto("song")
		.values({
			id: TestingUSCSong.id,
			legacy_id: 99_001,
			game_group: "usc",
			title: TestingUSCSong.title,
			artist: TestingUSCSong.artist,
			search_terms: TestingUSCSong.searchTerms,
			alt_titles: TestingUSCSong.altTitles,
			data: TestingUSCSong.data,
			fts_document: "",
		})
		.execute();

	await DB.insertInto("chart")
		.values({
			id: chart.chartID,
			legacy_id: chart.chartID,
			game,
			song_id: TestingUSCSong.id,
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

async function insertUscScoreRow(opts: {
	chartId: string;
	game: "usc-controller" | "usc-keyboard";
	scoreData: ScoreData<"usc-controller" | "usc-keyboard">;
	scoreId: string;
	timeAchievedMs: number;
	userId: number;
}) {
	const { data, derived, judgements } = mongoScoreDataToPg(opts.game, opts.scoreData);
	const t = UnixMillisecondsToISO8601(opts.timeAchievedMs);

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
			time_achieved: t,
			time_added: t,
			highlight: false,
			comment: null,
		})
		.execute();
}

describe.each([
	["Controller", USC_CONTROLLER_IMPL, "usc-controller"] as const,
	["Keyboard", USC_KEYBOARD_IMPL, "usc-keyboard"] as const,
])("USC %s implementation", (_playtypeName, impl, game) => {
	const chart = dmf(TestingUSCChart, { game } as never);

	describe("scoreDeriver (grade)", () => {
		const g = (score: number, expected: string) =>
			expect(
				impl.scoreDeriver(dmf(baseMetrics, { score }) as never, chart as never).grade,
			).toBe(expected);

		it("maps score thresholds to letter grades", () => {
			g(0, "D");
			g(7_000_000, "C");
			g(8_000_000, "B");
			g(8_700_000, "A");
			g(9_000_000, "A+");
			g(9_300_000, "AA");
			g(9_500_000, "AA+");
			g(9_700_000, "AAA");
			g(9_800_000, "AAA+");
			g(9_900_000, "S");
			g(10_000_000, "PUC");
		});
	});

	describe("classDerivers (VF7 → vfClass)", () => {
		const vf = (v: number | null, expected: ReturnType<typeof impl.classDerivers>["vfClass"]) =>
			expect(impl.classDerivers({ VF7: v }).vfClass).toBe(expected);

		it("maps VOLFORCE to VF class tiers", () => {
			vf(null, null);
			vf(0, "SIENNA_I");

			vf(23, "IMPERIAL_IV");
			vf(22, "IMPERIAL_III");
			vf(21, "IMPERIAL_II");
			vf(20, "IMPERIAL_I");
			vf(19.75, "CRIMSON_IV");
			vf(19.5, "CRIMSON_III");
			vf(19.25, "CRIMSON_II");
			vf(19, "CRIMSON_I");
			vf(18.75, "ELDORA_IV");
			vf(18.5, "ELDORA_III");
			vf(18.25, "ELDORA_II");
			vf(18, "ELDORA_I");
			vf(17.75, "ARGENTO_IV");
			vf(17.5, "ARGENTO_III");
			vf(17.25, "ARGENTO_II");
			vf(17, "ARGENTO_I");
			vf(16.75, "CORAL_IV");
			vf(16.5, "CORAL_III");
			vf(16.25, "CORAL_II");
			vf(16, "CORAL_I");
			vf(15.75, "SCARLET_IV");
			vf(15.5, "SCARLET_III");
			vf(15.25, "SCARLET_II");
			vf(15, "SCARLET_I");
			vf(14.75, "CYAN_IV");
			vf(14.5, "CYAN_III");
			vf(14.25, "CYAN_II");
			vf(14, "CYAN_I");
			vf(13.5, "DANDELION_IV");
			vf(13, "DANDELION_III");
			vf(12.5, "DANDELION_II");
			vf(12, "DANDELION_I");
			vf(11.5, "COBALT_IV");
			vf(11, "COBALT_III");
			vf(10.5, "COBALT_II");
			vf(10, "COBALT_I");
			vf(7.5, "SIENNA_IV");
			vf(5, "SIENNA_III");
			vf(2.5, "SIENNA_II");
		});
	});

	describe("goal formatters", () => {
		const mockScore = mkMockScore(game, chart, scoreData);
		const mockPB = mkMockPB(game, chart, scoreData);

		it("formats score criteria", () => {
			expect(impl.goalCriteriaFormatters.score(908_182)).toBe("Get a score of 908,182 on");
		});

		it("formats progress for grade, score, and lamp", () => {
			const f = (
				k: keyof typeof impl.goalProgressFormatters,
				modifant: Partial<ScoreData<typeof game>>,
				goalValue: number,
				expected: string,
			) =>
				expect(
					impl.goalProgressFormatters[k](
						dmf(mockPB, {
							scoreData: modifant,
						}) as never,
						goalValue,
					),
				).toBe(expected);

			f("grade", { grade: "AAA+", score: 9_817_342 }, SDVX_GRADES.S, "S-83K");
			f("score", { score: 9_820_123 }, 1_000_000, "9,820,123");
			f("lamp", { lamp: "CLEAR" }, USC_LAMPS.CLEAR, "CLEAR");
		});

		it("formats out-of score", () => {
			expect(impl.goalOutOfFormatters.score(901_003)).toBe("901,003");
			expect(impl.goalOutOfFormatters.score(983_132)).toBe("983,132");
		});
	});

	describe("PB merging (CreatePBDoc)", () => {
		beforeEach(async () => {
			await seedUscSongAndChart(game);
		});

		it("joins best lamp into the default-metric PB", async () => {
			const { id: userId } = await seedUser({ username: `usc_pb_${game}` });

			const main = mkMockScore(game, chart, scoreData);
			const lampScoreData: ScoreData<typeof game> = {
				...scoreData,
				score: 0,
				lamp: "ULTIMATE CHAIN",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: USC_LAMPS.ULTIMATE_CHAIN,
				},
			};

			await insertUscScoreRow({
				userId,
				game,
				chartId: chart.chartID,
				scoreId: main.scoreID,
				scoreData,
				timeAchievedMs: 1_000,
			});

			await insertUscScoreRow({
				userId,
				game,
				chartId: chart.chartID,
				scoreId: "bestLamp",
				scoreData: lampScoreData,
				timeAchievedMs: 2_000,
			});

			const pb = await CreatePBDoc(game, userId, chart, log);

			expect(pb).toMatchObject({
				composedFrom: [{ name: "Best Score" }, { name: "Best Lamp", scoreID: "bestLamp" }],
				scoreData: {
					score: scoreData.score,
					lamp: "ULTIMATE CHAIN",
					enumIndexes: { lamp: USC_LAMPS.ULTIMATE_CHAIN },
				},
			});
		});
	});
});
