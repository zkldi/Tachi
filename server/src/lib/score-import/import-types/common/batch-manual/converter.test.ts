import { ConverterBatchManual, ResolveChartFromSong, ResolveSongAndChart } from "./converter";
import { InvalidScoreFailure } from "../../../framework/common/converter-failures";
import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import { dmf } from "test-utils/misc";
import ResetDBState from "test-utils/resets";
import {
	BMSGazerChart,
	BMSGazerSong,
	Testing511Song,
	Testing511SPA,
	TestingSDVXAlbidaChart,
} from "test-utils/test-data";
import { EscapeStringRegexp } from "utils/misc";
import type { BatchManualContext } from "./types";
import type { BatchManualScore, ChartDocument, Game } from "tachi-common";

const baseBatchManualScore = {
	score: 500,
	lamp: "HARD CLEAR" as const,
	matchType: "tachiSongID" as const,
	identifier: "1",
	difficulty: "ANOTHER" as const,
};

const context = {
	game: "iidx" as const,
	playtype: "SP" as const,
	service: "foo",
	version: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ktdWrap = (msg: string, game: Game = "iidx", version = null): any => ({
	importType: "file/batch-manual",
	message: new RegExp(EscapeStringRegexp(msg), "u"),
	converterContext: { game, service: "foo", version },

	// any under t.match rules.
	data: {},
});

const logger = CreateLogCtx(__filename);

const importType = "file/batch-manual" as const;

t.test("#ResolveMatchTypeToTachiData", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should resolve for the songID if the matchType is songID", async (t) => {
		const res = await ResolveSongAndChart(baseBatchManualScore, context, importType, logger);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: Testing511SPA },
			"Should return the right song and chart."
		);

		t.rejects(
			() =>
				ResolveSongAndChart(
					// eslint-disable-next-line lines-around-comment
					// @ts-expect-error bad
					deepmerge(baseBatchManualScore, { identifier: "90000" }),
					context,
					importType,
					logger
				),
			ktdWrap("Cannot find song with songID 90000")
		);

		t.end();
	});

	t.test("Should resolve for the song title if the matchType is songTitle", async (t) => {
		const res = await ResolveSongAndChart(
			deepmerge(baseBatchManualScore, { matchType: "songTitle", identifier: "5.1.1." }),
			context,
			importType,
			logger
		);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: Testing511SPA },
			"Should return the right song and chart."
		);

		t.rejects(
			() =>
				ResolveSongAndChart(
					deepmerge(baseBatchManualScore, {
						matchType: "songTitle",
						identifier: "INVALID_TITLE",
					}),
					context,
					importType,
					logger
				),
			ktdWrap("Cannot find song with title INVALID_TITLE")
		);

		t.end();
	});

	t.test("Should resolve for the sdvx inGameID if matchType is sdvxInGameID", async (t) => {
		const res = await ResolveSongAndChart(
			{
				matchType: "sdvxInGameID",
				identifier: "1",
				difficulty: "ADV",
				lamp: "CLEAR",
				score: 9_000_001,
			},
			{ game: "sdvx", playtype: "Single", service: "foo", version: null },
			importType,
			logger
		);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: { data: { inGameID: 1 } } },
			"Should return the right song and chart."
		);

		t.rejects(
			() =>
				ResolveSongAndChart(
					{
						matchType: "sdvxInGameID",
						identifier: "9999999",
						difficulty: "ADV",
						lamp: "CLEAR",
						score: 9_000_001,
					},
					{ game: "sdvx", playtype: "Single", service: "foo", version: null },
					importType,
					logger
				),
			ktdWrap("Cannot find SDVX chart with inGameID 9999999", "sdvx")
		);

		t.end();
	});

	t.test("Should support ANY_INF if matchType is sdvxInGameID", async (t) => {
		await db.charts.sdvx.insert(
			deepmerge(TestingSDVXAlbidaChart, {
				chartID: "fake_xcd",
				data: {},
				difficulty: "XCD",
			} as ChartDocument<"sdvx:Single">)
		);

		const res = await ResolveSongAndChart(
			{
				matchType: "sdvxInGameID",
				identifier: "1",
				difficulty: "ANY_INF",
				lamp: "CLEAR",
				score: 9_000_001,
			},
			{ game: "sdvx", playtype: "Single", service: "foo", version: null },
			importType,
			logger
		);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: { data: { inGameID: 1 }, difficulty: "XCD" } },
			"Should return the right song and chart."
		);

		t.end();
	});

	t.test("Should resolve for the bms chartHash if the matchType is bmsChartHash", async (t) => {
		const GAZER17MD5 = "38616b85332037cc12924f2ae2840262";
		const GAZER17SHA256 = "195fe1be5c3e74fccd04dc426e05f8a9cfa8a1059c339d0a23e99f63661f0b7d";

		const bmsContext: BatchManualContext = deepmerge(context, { game: "bms", playtype: "7K" });

		const resMD5 = await ResolveSongAndChart(
			deepmerge(baseBatchManualScore, {
				matchType: "bmsChartHash",
				identifier: GAZER17MD5,
			}),
			bmsContext,
			importType,
			logger
		);

		t.hasStrict(
			resMD5,
			{ song: BMSGazerSong, chart: BMSGazerChart },
			"Should return the right song and chart."
		);

		const resSHA256 = await ResolveSongAndChart(
			deepmerge(baseBatchManualScore, {
				matchType: "bmsChartHash",
				identifier: GAZER17SHA256,
			}),
			bmsContext,
			importType,
			logger
		);

		t.hasStrict(
			resSHA256,
			{ song: BMSGazerSong, chart: BMSGazerChart },
			"Should return the right song and chart."
		);

		t.rejects(
			() =>
				ResolveSongAndChart(
					deepmerge(baseBatchManualScore, {
						matchType: "bmsChartHash",
						identifier: "bad_hash",
					}),
					bmsContext,
					importType,
					logger
				),
			ktdWrap("Cannot find chart for hash ", "bms")
		);

		t.end();
	});

	t.test("Should resolve for the popn chartHash if the matchType is popnChartHash", async (t) => {
		const chartHash = "2c26d666fa7c907e85115dbb279c267c14a263d47b2d46a93f99eae49d779119";

		const popnContext: BatchManualContext = deepmerge(context, {
			game: "popn",
			playtype: "9B",
		});

		const res = await ResolveSongAndChart(
			deepmerge(baseBatchManualScore, {
				matchType: "popnChartHash",
				identifier: chartHash,
			}),
			popnContext,
			importType,
			logger
		);

		t.hasStrict(
			res,
			{
				song: { id: 1 },
				chart: {
					songID: 1,
					data: { hashSHA256: chartHash },
					playtype: "9B",
				},
			},
			"Should return the right song and chart."
		);

		t.end();
	});

	t.test("Should reject if popnChartHash is used while game is not popn", (t) => {
		const chartHash = "2c26d666fa7c907e85115dbb279c267c14a263d47b2d46a93f99eae49d779119";

		t.rejects(() =>
			ResolveSongAndChart(
				deepmerge(baseBatchManualScore, {
					matchType: "popnChartHash",
					identifier: chartHash,
				}),
				context,
				importType,
				logger
			)
		);

		t.end();
	});

	t.test("Should resolve for the usc chartHash if the matchType is uscChartHash", async (t) => {
		const chartHash = "USC_CHART_HASH";

		const uscContext: BatchManualContext = deepmerge(context, {
			game: "usc",
			playtype: "Controller",
		});

		const res = await ResolveSongAndChart(
			deepmerge(baseBatchManualScore, {
				matchType: "uscChartHash",
				identifier: chartHash,
			}),
			uscContext,
			importType,
			logger
		);

		t.hasStrict(
			res,
			{
				song: { id: 1 },
				chart: { songID: 1, chartID: "USC_CHART_ID", playtype: "Controller" },
			},
			"Should return the right song and chart."
		);

		t.end();
	});

	t.test("Should honor playtype in uscChartHash despite non-unique chartIDs.", (t) => {
		const chartHash = "USC_CHART_HASH";

		const uscContext: BatchManualContext = deepmerge(context, {
			game: "usc",
			playtype: "Keyboard",
		});

		t.rejects(
			() =>
				ResolveSongAndChart(
					deepmerge(baseBatchManualScore, {
						matchType: "uscChartHash",
						identifier: chartHash,
					}),
					uscContext,
					importType,
					logger
				),
			ktdWrap("Cannot find chart with hash USC_CHART_HASH", "usc")
		);

		t.end();
	});

	t.test("Should trigger failsave if invalid matchType is provided.", (t) => {
		t.rejects(
			() =>
				ResolveSongAndChart(
					deepmerge(baseBatchManualScore, {
						matchType: "BAD_MATCHTYPE",
					}),
					context,
					importType,
					logger
				),
			new InvalidScoreFailure(`Cannot use matchType BAD_MATCHTYPE for beatmania IIDX (SP)`)
		);

		t.end();
	});

	t.end();
});

t.test("#ResolveChartFromSong", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should return the chart for the song + ptdf", async (t) => {
		const res = await ResolveChartFromSong(
			Testing511Song,

			// has playtype + diff
			baseBatchManualScore,

			{ game: "iidx", service: "foo", playtype: "SP", version: null },
			importType
		);

		t.hasStrict(res, Testing511SPA);

		t.end();
	});

	t.test("Should throw an error if no difficulty is provided.", (t) => {
		t.rejects(
			() =>
				ResolveChartFromSong(
					Testing511Song,
					deepmerge(baseBatchManualScore, { difficulty: null }),
					{ game: "iidx", service: "foo", playtype: "SP", version: null },
					importType
				),
			new InvalidScoreFailure(
				`Missing 'difficulty' field, but was necessary for this lookup.`
			)
		);

		t.end();
	});

	t.test("Should throw an error if an invalid difficulty is provided.", (t) => {
		t.rejects(
			() =>
				ResolveChartFromSong(
					Testing511Song,
					deepmerge(baseBatchManualScore, {
						difficulty: "NOT_VALID_DIFFICULTY" as const,
					}),
					{ game: "iidx", service: "foo", playtype: "SP", version: null },
					importType
				),
			/Invalid Difficulty for iidx SP/u
		);

		t.end();
	});

	t.test("Should throw an error if no chart could be found.", (t) => {
		t.rejects(
			() =>
				ResolveChartFromSong(
					Testing511Song,

					// 511 has no legg (yet, lol)
					deepmerge(baseBatchManualScore, { difficulty: "LEGGENDARIA" as const }),
					{ game: "iidx", service: "foo", version: null, playtype: "SP" },
					importType
				),
			ktdWrap("Cannot find chart for 5.1.1. (SP LEGGENDARIA)")
		);

		t.end();
	});

	t.test("Should successfully lookup if version is provided.", async (t) => {
		const res = await ResolveChartFromSong(
			Testing511Song,
			baseBatchManualScore,
			{
				game: "iidx",
				service: "foo",
				playtype: "SP",
				version: "27",
			},
			importType
		);

		t.hasStrict(res, Testing511SPA);

		t.end();
	});

	t.end();
});

t.test("#ConverterFn", (t) => {
	t.test("Should produce a DryScore", async (t) => {
		const res = await ConverterBatchManual(
			baseBatchManualScore,
			{ game: "iidx", service: "foo", playtype: "SP", version: null },
			importType,
			logger
		);

		t.hasStrict(res, {
			chart: Testing511SPA,
			song: { id: 1 },
			dryScore: {
				game: "iidx",
				service: "foo (BATCH-MANUAL)",
				comment: null,
				importType: "file/batch-manual",
				timeAchieved: null,
				scoreData: {
					lamp: "HARD CLEAR",
					score: 500,
					judgements: {},
					optional: {},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	t.test("Should mount optionals", async (t) => {
		const res = await ConverterBatchManual(
			dmf(baseBatchManualScore as any, {
				optional: {
					bp: 123,
				},
			}),
			{ game: "iidx", service: "foo", playtype: "SP", version: null },
			importType,
			logger
		);

		t.hasStrict(res, {
			chart: Testing511SPA,
			song: { id: 1 },
			dryScore: {
				game: "iidx",
				service: "foo (BATCH-MANUAL)",
				comment: null,
				importType: "file/batch-manual",
				timeAchieved: null,
				scoreData: {
					lamp: "HARD CLEAR",
					score: 500,
					judgements: {},
					optional: {
						bp: 123,
					},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	t.test("Should mount hitMeta as optionals", async (t) => {
		const res = await ConverterBatchManual(
			dmf(baseBatchManualScore as any, {
				hitMeta: {
					bp: 123,
				},
			}),
			{ game: "iidx", service: "foo", playtype: "SP", version: null },
			importType,
			logger
		);

		t.hasStrict(res, {
			chart: Testing511SPA,
			song: { id: 1 },
			dryScore: {
				game: "iidx",
				service: "foo (BATCH-MANUAL)",
				comment: null,
				importType: "file/batch-manual",
				timeAchieved: null,
				scoreData: {
					lamp: "HARD CLEAR",
					score: 500,
					judgements: {},
					optional: {
						bp: 123,
					},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	t.test("Should mount judgements", async (t) => {
		const res = await ConverterBatchManual(
			dmf(baseBatchManualScore as any, {
				judgements: {
					pgreat: 13,
					great: 3,
				},
			}),
			{ game: "iidx", service: "foo", playtype: "SP", version: null },
			importType,
			logger
		);

		t.hasStrict(res, {
			chart: Testing511SPA,
			song: { id: 1 },
			dryScore: {
				game: "iidx",
				service: "foo (BATCH-MANUAL)",
				comment: null,
				importType: "file/batch-manual",
				timeAchieved: null,
				scoreData: {
					lamp: "HARD CLEAR",
					score: 500,
					judgements: {
						pgreat: 13,
						great: 3,
					},
					optional: {},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	const baseJubeatScore: BatchManualScore = {
		musicRate: 10,
		score: 920_000,
		identifier: "1",
		lamp: "CLEAR",
		matchType: "tachiSongID",
		difficulty: "ADV",
	};

	t.test("Should use the provided percent parameter for jubeat", async (t) => {
		const res = await ConverterBatchManual(
			baseJubeatScore,
			{ game: "jubeat", service: "foo", playtype: "Single", version: null },
			importType,
			logger
		);

		t.hasStrict(res, {
			chart: { songID: 1, difficulty: "ADV", playtype: "Single" },
			song: { id: 1 },
			dryScore: {
				game: "jubeat",
				service: "foo (BATCH-MANUAL)",
				comment: null,
				importType: "file/batch-manual",
				timeAchieved: null,
				scoreData: {
					score: 920_000,
					musicRate: 10,
					judgements: {},
					optional: {},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	t.test("Should produce a with timeAchieved null if timeAchieved is 0", async (t) => {
		const res = await ConverterBatchManual(
			deepmerge(baseBatchManualScore, { timeAchieved: 0 }),
			{ game: "iidx", service: "foo", playtype: "SP", version: null },
			importType,
			logger
		);

		t.hasStrict(res, {
			chart: Testing511SPA,
			song: { id: 1 },
			dryScore: {
				game: "iidx",
				service: "foo (BATCH-MANUAL)",
				comment: null,
				importType: "file/batch-manual",
				timeAchieved: null,
				scoreData: {
					lamp: "HARD CLEAR",
					score: 500,
					judgements: {},
					optional: {},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	t.end();
});
