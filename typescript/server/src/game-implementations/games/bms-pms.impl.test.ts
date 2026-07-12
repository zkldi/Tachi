import {
	BMS_7K_IMPL,
	BMS_14K_IMPL,
	PMS_CONTROLLER_IMPL,
	PMS_KEYBOARD_IMPL,
} from "#game-implementations/games/bms-pms";
import { log } from "#lib/log/log";
import { CreatePBDoc } from "#lib/score-import/framework/pb/create-pb-doc";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { dmf, mkMockPB, mkMockScore } from "#test-utils/misc";
import { seedUser } from "#test-utils/pg-fixtures";
import { BMSGazerChart, BMSGazerSong } from "#test-utils/test-data";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import {
	type BMSGames,
	type ChartDocument,
	type ChartDocumentData,
	FormatGoalCriteria,
	GAME_GOAL_PROGRESS_FORMATTERS,
	GetGameConfig,
	GetScoreMetricConf,
	IIDX_GRADES,
	IIDX_LAMPS,
	type MongoProvidedMetrics,
	type ScoreData,
	type SongDocument,
} from "tachi-common";
import { beforeEach, describe, expect, it } from "vitest";

const max = 2256 * 2;

function percentToScore(percent: number) {
	return (percent / 100) * max;
}

function scoreToPercent(score: number) {
	return (100 * score) / max;
}

const pmsGazerSong: SongDocument<"pms"> = {
	id: BMSGazerSong.id,
	title: BMSGazerSong.title,
	artist: BMSGazerSong.artist,
	searchTerms: BMSGazerSong.searchTerms,
	altTitles: BMSGazerSong.altTitles,
	data: {
		genre: BMSGazerSong.data.genre,
		subtitle: BMSGazerSong.data.subtitle,
		subartist: BMSGazerSong.data.subartist,
		tableString: BMSGazerSong.data.tableString,
	},
};

function makeChart<G extends BMSGames>(game: G): ChartDocument<G> {
	if (game === "bms-7k" || game === "bms-14k") {
		return {
			...BMSGazerChart,
			game,
			song: BMSGazerSong,
		} as ChartDocument<G>;
	}

	const { aiLevel: _omit, ...pmsData } = BMSGazerChart.data;

	return {
		game,
		chartID: BMSGazerChart.chartID,
		data: pmsData as ChartDocumentData[G],
		level: BMSGazerChart.level,
		levelNum: BMSGazerChart.levelNum,
		difficulty: "CHART",
		isPrimary: true,
		versions: [],
		song: pmsGazerSong,
	} as ChartDocument<G>;
}

describe.each([
	["bms-7k", BMS_7K_IMPL] as const,
	["bms-14k", BMS_14K_IMPL] as const,
	["pms-controller", PMS_CONTROLLER_IMPL] as const,
	["pms-keyboard", PMS_KEYBOARD_IMPL] as const,
])("%s", (game, impl) => {
	type G = typeof game;

	const chart = makeChart(game);

	const baseMetrics: MongoProvidedMetrics[G] = {
		lamp: "CLEAR",
		score: Math.floor(percentToScore(79.123)),
	};

	const scoreData: ScoreData<G> = {
		lamp: "CLEAR",
		score: Math.floor(percentToScore(79.123)),
		grade: "AA",
		percent: 79.123,
		enumIndexes: { grade: IIDX_GRADES.AA, lamp: IIDX_LAMPS.CLEAR },
		judgements: {},
		optional: { enumIndexes: {} },
	};

	const mockScore = mkMockScore(game, chart, scoreData);
	const mockPB = mkMockPB(game, chart, scoreData);

	describe("scoreDeriver", () => {
		it("percent", () => {
			const f = (modifant: Partial<typeof baseMetrics>, expected: number, _msg?: string) => {
				expect(
					impl.scoreDeriver(dmf(baseMetrics, modifant) as never, chart as never).percent,
				).toBe(expected);
			};

			f({ score: 1000 }, (100 * 1000) / max);
			f({ score: 0 }, 0);
			f({ score: chart.data.notecount * 2 }, 100);
		});

		it("grade from percent", () => {
			const f = (percent: number, expected: string) => {
				expect(
					impl.scoreDeriver(
						dmf(baseMetrics, { score: percentToScore(percent) }) as never,
						chart as never,
					).grade,
				).toBe(expected);
			};

			f(0, "F");
			f(22.23, "E");
			f(33.34, "D");
			f(44.45, "C");
			f(55.56, "B");
			f(66.67, "A");
			f(77.78, "AA");
			f(88.89, "AAA");
			f(94.45, "MAX-");
			f(100, "MAX");

			f(0, "F");
			f(11.11, "F");
			f(22.22, "F");
			f(33.33, "E");
			f(44.44, "D");
			f(55.55, "C");
			f(66.66, "B");
			f(77.77, "A");
			f(88.88, "AA");
			f(94.44, "AAA");
			f(99.99, "MAX-");
		});
	});

	describe("chartSpecificValidators", () => {
		it("accepts in-range EX score", () => {
			expect(impl.chartSpecificValidators.score(1000, chart as never)).toBe(true);
			expect(impl.chartSpecificValidators.score(0, chart as never)).toBe(true);
			expect(
				impl.chartSpecificValidators.score(chart.data.notecount * 2, chart as never),
			).toBe(true);
		});

		it("rejects out-of-range EX score", () => {
			expect(impl.chartSpecificValidators.score(-1, chart as never)).toBe(
				"EX Score cannot be negative.",
			);
			expect(
				impl.chartSpecificValidators.score(chart.data.notecount * 2 + 1, chart as never),
			).toBe(`EX Score cannot be greater than ${chart.data.notecount * 2} for this chart.`);
		});
	});

	describe("scoreCalcs sieglinde", () => {
		const f = (
			sd: Partial<ScoreData<G>>,
			chartData: Partial<ChartDocumentData[G]>,
			expected: number,
			_msg?: string,
		) => {
			const mergedSd = dmf(mockScore.scoreData, sd);
			const ch = dmf(chart, { data: chartData as never });

			expect(
				impl.scoreCalcs(mergedSd, impl.scoreDeriver(mergedSd, ch as never), ch as never)
					.sieglinde,
			).toBe(expected);
		};

		it("null / failed lamps", () => {
			f({ lamp: "FAILED" }, {}, 0);
			f({ lamp: "ASSIST CLEAR" }, {}, 0);
			f({ lamp: "EASY CLEAR" }, {}, 0);
			f({ lamp: "CLEAR" }, {}, 0);
			f({ lamp: "HARD CLEAR" }, {}, 0);
			f({ lamp: "EX HARD CLEAR" }, {}, 0);
			f({ lamp: "FULL COMBO" }, {}, 0);
		});

		it("sieglinde tiers", () => {
			f({ lamp: "FAILED" }, { sglEC: 10, sglHC: 11 }, 0);
			f({ lamp: "ASSIST CLEAR" }, { sglEC: 10, sglHC: 11 }, 0);
			f({ lamp: "EASY CLEAR" }, { sglEC: 10, sglHC: 11 }, 10);
			f({ lamp: "CLEAR" }, { sglEC: 10, sglHC: 11 }, 10);
			f({ lamp: "HARD CLEAR" }, { sglEC: 10, sglHC: 11 }, 11);
			f({ lamp: "EX HARD CLEAR" }, { sglEC: 10, sglHC: 11 }, 11);
			f({ lamp: "FULL COMBO" }, { sglEC: 10, sglHC: 11 }, 11);

			f({ lamp: "HARD CLEAR" }, { sglEC: 10 }, 10);
			f({ lamp: "EX HARD CLEAR" }, { sglEC: 10 }, 10);
			f({ lamp: "FULL COMBO" }, { sglEC: 10 }, 10);
		});
	});

	describe("goal formatters", () => {
		it("criteria", () => {
			expect(
				FormatGoalCriteria({ key: "percent", value: 94.42123, mode: "single" }, game),
			).toBe("Get 94.42% on");
			expect(
				FormatGoalCriteria({ key: "percent", value: 94.426, mode: "single" }, game),
			).toBe("Get 94.43% on");
			expect(FormatGoalCriteria({ key: "score", value: 3570, mode: "single" }, game)).toBe(
				"Get a score of 3570 on",
			);
			expect(FormatGoalCriteria({ key: "score", value: 0, mode: "single" }, game)).toBe(
				"Get a score of 0 on",
			);
		});

		it("progress", () => {
			const fmt = GAME_GOAL_PROGRESS_FORMATTERS[game];
			const f = (
				k: keyof typeof fmt,
				modifant: Partial<ScoreData<G>>,
				goalValue: unknown,
				expected: string,
			) => {
				expect(
					fmt[k](
						dmf(mockPB, {
							scoreData: modifant,
						}) as never,
						goalValue as never,
					),
				).toBe(expected);
			};

			f("score", { score: 3570 }, 1000, "3570");
			f("score", { score: 0 }, 1000, "0");

			f("percent", { percent: 92.17472 }, 100, "92.17%");
			f("percent", { percent: 92.17572 }, 100, "92.18%");

			f(
				"grade",
				{ score: 3570, percent: scoreToPercent(3570), grade: "AA" },
				IIDX_GRADES.AAA,
				"AAA-441",
			);
			f(
				"grade",
				{ score: 3670, percent: scoreToPercent(3670), grade: "AA" },
				IIDX_GRADES.AAA,
				"AAA-341",
			);
			f(
				"grade",
				{ score: 4070, percent: scoreToPercent(4070), grade: "AAA" },
				IIDX_GRADES.AAA,
				"AAA+59",
			);

			f(
				"lamp",
				{ lamp: "HARD CLEAR", optional: { bp: 2 } as never },
				IIDX_LAMPS.HARD_CLEAR,
				"HARD CLEAR (BP: 2)",
			);

			f(
				"lamp",
				{ lamp: "HARD CLEAR", optional: { bp: null } as never },
				IIDX_LAMPS.HARD_CLEAR,
				"HARD CLEAR",
			);
		});

		it("outOf", () => {
			const gConf = GetGameConfig(game);
			const toFmt = (m: string) =>
				(GetScoreMetricConf(gConf, m) as { goalOutOfFormatter: (v: number) => string })
					.goalOutOfFormatter;
			expect(toFmt("percent")(94.42123)).toBe("94.42%");
			expect(toFmt("score")(3570)).toBe("3570");
		});
	});

	describe("CreatePBDoc merges", () => {
		async function seedSongAndChart() {
			const gameGroup = game.startsWith("pms") ? "pms" : "bms";

			await DB.insertInto("song")
				.values({
					id: chart.song.id,
					legacy_id: 27_339,
					game_group: gameGroup,
					title: chart.song.title,
					artist: chart.song.artist,
					search_terms: chart.song.searchTerms,
					alt_titles: chart.song.altTitles,
					data: chart.song.data,
					fts_document: "",
				})
				.execute();

			await DB.insertInto("chart")
				.values({
					id: chart.chartID,
					legacy_id: chart.chartID,
					game,
					song_id: chart.song.id,
					difficulty: chart.difficulty,
					level: chart.level,
					level_num: chart.levelNum,
					is_primary: chart.isPrimary,
					versions: chart.versions,
					data: chart.data,
				})
				.execute();
		}

		async function insertScoreRow(opts: {
			scoreId: string;
			sd: ScoreData<G>;
			timeMs: number;
			userId: number;
		}) {
			const { data, derived, judgements } = mongoScoreDataToPg(game, opts.sd);
			const ts = UnixMillisecondsToISO8601(opts.timeMs);

			await DB.insertInto("score")
				.values({
					id: opts.scoreId,
					user_id: opts.userId,
					chart_id: chart.chartID,
					game,
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

		beforeEach(seedSongAndChart);

		it("joins best lamp", async () => {
			const { id: userId } = await seedUser({ username: `bms_pms_pb_lamp_${game}` });
			const main = mkMockScore(game, chart, scoreData);

			const lampScore: ScoreData<G> = {
				...scoreData,
				score: 0,
				lamp: "FULL COMBO",
				enumIndexes: {
					...scoreData.enumIndexes,
					lamp: IIDX_LAMPS.FULL_COMBO,
				},
			};

			await insertScoreRow({ scoreId: main.scoreID, sd: scoreData, timeMs: 1000, userId });
			await insertScoreRow({ scoreId: "bestLamp", sd: lampScore, timeMs: 2000, userId });

			const pb = await CreatePBDoc(game, userId, chart as never, log);

			expect(pb).toMatchObject({
				composedFrom: [{ name: "Best Score" }, { name: "Best Lamp", scoreID: "bestLamp" }],
				scoreData: {
					score: scoreData.score,
					lamp: "FULL COMBO",
					enumIndexes: {
						lamp: IIDX_LAMPS.FULL_COMBO,
					},
				},
			});
		});

		it("joins lowest BP", async () => {
			const { id: userId } = await seedUser({ username: `bms_pms_pb_bp_${game}` });
			const main = mkMockScore(game, chart, scoreData);

			await insertScoreRow({ scoreId: main.scoreID, sd: scoreData, timeMs: 1000, userId });

			const hiBp: ScoreData<G> = {
				...scoreData,
				optional: { ...scoreData.optional, bp: 100 },
			};
			const loBp: ScoreData<G> = {
				...scoreData,
				optional: { ...scoreData.optional, bp: 1 },
			};

			await insertScoreRow({ scoreId: "whateverBP", sd: hiBp, timeMs: 2000, userId });
			await insertScoreRow({ scoreId: "lowestBP", sd: loBp, timeMs: 3000, userId });

			const pb = await CreatePBDoc(game, userId, chart as never, log);

			expect(pb).toMatchObject({
				composedFrom: [{ name: "Best Score" }, { name: "Lowest BP", scoreID: "lowestBP" }],
				scoreData: {
					score: scoreData.score,
					optional: { bp: 1 },
				},
			});
		});
	});
});
