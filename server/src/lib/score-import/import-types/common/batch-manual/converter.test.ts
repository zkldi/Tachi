import {
	BatchManualScoreToResolver,
	ConverterBatchManual,
	ResolveChartFromSong,
	ResolveSongAndChart,
} from "./converter";
import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { InvalidScoreFailure } from "lib/score-import/framework/common/converter-failures";
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
import type {
	BatchManualScore,
	ChartDocument,
	MatchTypeResolver,
	MatchTypeResolverWithDifficulty,
} from "tachi-common";

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

const logger = CreateLogCtx(__filename);

const importType = "file/batch-manual" as const;

const baseResolver: MatchTypeResolver = BatchManualScoreToResolver(baseBatchManualScore, context);
const baseResolverWithDiff: MatchTypeResolverWithDifficulty = BatchManualScoreToResolver(
	baseBatchManualScore,
	context
) as MatchTypeResolverWithDifficulty;

t.test("#ResolveSongAndChart", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should resolve for the songID if the matchType is songID", async (t) => {
		const res = await ResolveSongAndChart(baseResolver, logger);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: Testing511SPA },
			"Should return the right song and chart."
		);

		t.equal(
			await ResolveSongAndChart(
				// eslint-disable-next-line lines-around-comment
				// @ts-expect-error bad
				deepmerge(baseResolver, { identifier: "90000" }),
				logger
			),
			null
		);

		t.end();
	});

	t.test("Should resolve for the song title if the matchType is songTitle", async (t) => {
		const res = await ResolveSongAndChart(
			// @ts-expect-error bad
			deepmerge(baseResolver, { matchType: "songTitle", identifier: "5.1.1." }),
			logger
		);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: Testing511SPA },
			"Should return the right song and chart."
		);

		t.equal(
			await ResolveSongAndChart(
				// @ts-expect-error bad
				deepmerge(baseResolver, {
					matchType: "songTitle",
					identifier: "INVALID_TITLE",
				}),
				logger
			),
			null
		);

		t.end();
	});

	t.test("Should resolve for the sdvx inGameID if matchType is sdvxInGameID", async (t) => {
		const res = await ResolveSongAndChart(
			{
				matchType: "sdvxInGameID",
				identifier: "1",
				difficulty: "ADV",
				game: "sdvx",
				playtype: "Single",
				version: null,
			},
			logger
		);

		t.hasStrict(
			res,
			{ song: { id: 1 }, chart: { data: { inGameID: 1 } } },
			"Should return the right song and chart."
		);

		t.equal(
			await ResolveSongAndChart(
				{
					matchType: "sdvxInGameID",
					identifier: "9999999",
					difficulty: "ADV",
					game: "sdvx",
					playtype: "Single",
					version: null,
				},
				logger
			),
			null
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
				game: "sdvx",
				playtype: "Single",
				version: null,
			},
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

		const resMD5 = await ResolveSongAndChart(
			{
				matchType: "bmsChartHash",
				identifier: GAZER17MD5,
				game: "bms",
				playtype: "7K",
				version: null,
			},
			logger
		);

		t.hasStrict(
			resMD5,
			{ song: BMSGazerSong, chart: BMSGazerChart },
			"Should return the right song and chart."
		);

		const resSHA256 = await ResolveSongAndChart(
			{
				matchType: "bmsChartHash",
				identifier: GAZER17SHA256,
				game: "bms",
				playtype: "7K",
				version: null,
			},
			logger
		);

		t.hasStrict(
			resSHA256,
			{ song: BMSGazerSong, chart: BMSGazerChart },
			"Should return the right song and chart."
		);

		t.equal(
			await ResolveSongAndChart(
				{
					matchType: "bmsChartHash",
					identifier: "bad_hash",
					game: "bms",
					playtype: "7K",
					version: null,
				},
				logger
			),
			null
		);

		t.end();
	});

	t.test("Should resolve for the popn chartHash if the matchType is popnChartHash", async (t) => {
		const chartHash = "2c26d666fa7c907e85115dbb279c267c14a263d47b2d46a93f99eae49d779119";

		const res = await ResolveSongAndChart(
			{
				matchType: "popnChartHash",
				identifier: chartHash,
				game: "popn",
				playtype: "9B",
				version: null,
			},
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
				{
					matchType: "popnChartHash",
					identifier: chartHash,
					game: "iidx",
					playtype: "SP",
					version: null,
				},
				logger
			)
		);

		t.end();
	});

	t.test("Should resolve for the usc chartHash if the matchType is uscChartHash", async (t) => {
		const chartHash = "USC_CHART_HASH";

		const res = await ResolveSongAndChart(
			{
				matchType: "uscChartHash",
				identifier: chartHash,
				game: "usc",
				playtype: "Controller",
				version: null,
			},
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

	t.test("Should honor playtype in uscChartHash despite non-unique chartIDs.", async (t) => {
		const chartHash = "USC_CHART_HASH";

		t.equal(
			await ResolveSongAndChart(
				{
					matchType: "uscChartHash",
					identifier: chartHash,
					game: "usc",
					playtype: "Keyboard",
					version: null,
				},
				logger
			),
			null
		);

		t.end();
	});

	t.test("Should trigger failsave if invalid matchType is provided.", (t) => {
		t.rejects(() =>
			ResolveSongAndChart(
				{
					// @ts-expect-error bad
					matchType: "BAD_MATCHTYPE",
					game: "iidx",
					playtype: "SP",
					version: null,
				},
				logger
			)
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
			baseResolverWithDiff
		);

		t.hasStrict(res, Testing511SPA);

		t.end();
	});

	t.test("Should return null if no difficulty is provided.", (t) => {
		t.rejects(() =>
			ResolveChartFromSong(
				Testing511Song,
				deepmerge(baseResolverWithDiff, { difficulty: null })
			)
		);

		t.end();
	});

	t.test("Should return null if an invalid difficulty is provided.", (t) => {
		t.rejects(() =>
			ResolveChartFromSong(
				Testing511Song,
				// @ts-expect-error bad
				deepmerge(baseResolverWithDiff, {
					difficulty: "NOT_VALID_DIFFICULTY",
				})
			)
		);

		t.end();
	});

	t.test("Should return null if no chart could be found.", async (t) => {
		t.equal(
			await ResolveChartFromSong(
				Testing511Song,

				// 511 has no legg (yet, lol)
				deepmerge(baseResolverWithDiff, { difficulty: "LEGGENDARIA" as const })
			),
			null
		);

		t.end();
	});

	t.test("Should successfully lookup if version is provided.", async (t) => {
		const res = await ResolveChartFromSong(Testing511Song, baseResolverWithDiff);

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
