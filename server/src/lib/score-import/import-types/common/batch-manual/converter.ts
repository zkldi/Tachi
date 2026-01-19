import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "../../../framework/common/converter-failures";
import {
	AssertStrAsDifficulty,
	AssertStrAsPositiveInt,
} from "../../../framework/common/string-asserts";
import db from "external/mongo/db";
import ScoreImportFatalError from "lib/score-import/framework/score-importing/score-import-error";
import { FormatGame, GetGamePTConfig } from "tachi-common";
import {
	FindBMSChartOnHash,
	FindChartWithPTDF,
	FindChartWithPTDFVersion,
	FindITGChartOnHash,
	FindSDVXChartOnInGameID,
	FindSDVXChartOnInGameIDVersion,
} from "utils/queries/charts";
import { FindSongOnID, FindSongOnTitleInsensitive } from "utils/queries/songs";
import type { DryScore } from "../../../framework/common/types";
import type { ConverterFunction } from "../types";
import type { BatchManualContext } from "./types";
import type { KtLogger } from "lib/logger/logger";
import type {
	BatchManualScore,
	ChartDocument,
	Difficulties,
	SongDocument,
	Versions,
	GPTString,
	ProvidedMetrics,
	MatchTypeResolver,
	MatchTypeResolverWithDifficulty,
} from "tachi-common";

// only public because used in tests; ts has no way of doing that
// lol
export function BatchManualScoreToResolver(
	data: BatchManualScore,
	context: BatchManualContext
): MatchTypeResolver {
	// already validated by prudence
	const resolver: MatchTypeResolver = {
		// @ts-expect-error already validated by prudence
		difficulty: data.difficulty,
		identifier: data.identifier,
		matchType: data.matchType,
		artist: data.artist,
		version: context.version,
		game: context.game,
		playtype: context.playtype,
	};

	return resolver;
}

/**
 * Creates a ConverterFn for the BatchManualScore format. This curries
 * the importType into the function, so the right failures can be
 * returned.
 * @returns A BatchManualScore Converter.
 */
export const ConverterBatchManual: ConverterFunction<BatchManualScore, BatchManualContext> = async (
	data,
	context,
	importType,
	logger
) => {
	const { game, playtype } = context;

	const resolver = BatchManualScoreToResolver(data, context);

	const got = await ResolveSongAndChart(resolver, logger);

	if (got === null) {
		throw new SongOrChartNotFoundFailure(
			`Cannot find chart ${resolver.matchType}:${resolver.identifier}.`,
			importType,
			data,
			context
		);
	}

	const { song, chart } = got;

	let service = context.service;

	if (importType === "ir/direct-manual") {
		service = `${service} (DIRECT-MANUAL)`;
	} else if (importType === "file/batch-manual") {
		service = `${service} (BATCH-MANUAL)`;
	}

	// create the metrics for this score.
	// @ts-expect-error this is filled out in a second, promise!
	const metrics: ProvidedMetrics[GPTString] = {};

	const config = GetGamePTConfig(game, playtype);

	for (const key of Object.keys(config.providedMetrics)) {
		// @ts-expect-error hacky type messery
		metrics[key] = data[key];
	}

	const dryScore: DryScore = {
		game,
		service,
		comment: data.comment ?? null,
		importType,

		// For backwards compatibility reasons, an explicitly passed timeAchieved of 0 should be interpreted as null.
		timeAchieved: data.timeAchieved === 0 ? null : data.timeAchieved ?? null,
		scoreData: {
			...metrics,
			judgements: data.judgements ?? {},

			// if hitMeta is provided and optional is not provided, use hitMeta.
			// this is for compatibility with old import methods.
			optional: data.optional ?? data.hitMeta ?? {},
		},
		scoreMeta: data.scoreMeta ?? {},
	};

	return {
		chart,
		song,
		dryScore,
	};
};

export async function ResolveSongAndChart(
	resolver: MatchTypeResolver,
	logger: KtLogger
): Promise<{ song: SongDocument; chart: ChartDocument } | null> {
	const { game, playtype } = resolver;

	const config = GetGamePTConfig(game, playtype);

	if (!config.supportedMatchTypes.includes(resolver.matchType)) {
		// special, more helpful error message
		if (game === "sdvx" && resolver.matchType === "inGameID") {
			throw new InvalidScoreFailure(
				`Cannot use matchType ${resolver.matchType} for ${FormatGame(
					game,
					playtype
				)}. Use 'sdvxInGameID' instead.`
			);
		}

		throw new InvalidScoreFailure(
			`Cannot use matchType ${resolver.matchType} for ${FormatGame(
				game,
				playtype
			)}. Expected any of ${config.supportedMatchTypes.join(", ")}.`
		);
	}

	switch (resolver.matchType) {
		case "bmsChartHash": {
			const chart = await FindBMSChartOnHash(resolver.identifier);

			if (!chart) {
				return null;
			}

			if (chart.playtype !== playtype) {
				throw new InvalidScoreFailure(
					`Chart ${chart.chartID}'s playtype was ${chart.playtype}, but this was not equal to the import playtype of ${playtype}.`
				);
			}

			const song = await FindSongOnID(game, chart.songID);

			if (!song) {
				logger.severe(`BMS songID ${chart.songID} has charts but no parent song.`);
				throw new InternalFailure(
					`BMS songID ${chart.songID} has charts but no parent song.`
				);
			}

			return { chart, song };
		}

		case "itgChartHash": {
			const chart = await FindITGChartOnHash(resolver.identifier);

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(game, chart.songID);

			if (!song) {
				logger.severe(`ITG songID ${chart.songID} has charts but no parent song.`);
				throw new InternalFailure(
					`ITG songID ${chart.songID} has charts but no parent song.`
				);
			}

			return { song, chart };
		}

		case "popnChartHash": {
			if (playtype !== "9B") {
				throw new InvalidScoreFailure(`Invalid playtype '${playtype}', expected 9B.`);
			}

			const chart = await db.charts.popn.findOne({
				playtype,
				"data.hashSHA256": resolver.identifier,
			});

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(game, chart.songID);

			if (!song) {
				logger.severe(`Pop'n songID ${chart.songID} has charts but no parent song.`);
				throw new InternalFailure(
					`Pop'n songID ${chart.songID} has charts but no parent song.`
				);
			}

			return { song, chart };
		}

		case "tachiSongID": {
			const songID = AssertStrAsPositiveInt(
				resolver.identifier,
				"Invalid songID - must be a stringified positive integer."
			);

			const song = await FindSongOnID(game, songID);

			if (!song) {
				return null;
			}

			const chart = await ResolveChartFromSong(song, resolver);

			if (!chart) {
				return null;
			}

			return { song, chart };
		}

		case "songTitle": {
			const song = await FindSongOnTitleInsensitive(
				game,
				resolver.identifier,
				resolver.artist
			);

			if (!song) {
				return null;
			}

			const chart = await ResolveChartFromSong(song, resolver);

			if (!chart) {
				return null;
			}

			return { song, chart };
		}

		case "sdvxInGameID": {
			let chart: ChartDocument | null;

			const identifier = Number(resolver.identifier);

			const config = GetGamePTConfig("sdvx", "Single");

			if (config.difficulties.type === "DYNAMIC") {
				logger.error(
					`SDVX has 'DYNAMIC' difficulties set. This is completely unexpected.`,
					{ config }
				);
				throw new ScoreImportFatalError(
					500,
					`SDVX has 'DYNAMIC' difficulties set. This is completely unexpected.`
				);
			}

			if (
				!config.difficulties.order.includes(resolver.difficulty) &&
				resolver.difficulty !== "ANY_INF"
			) {
				throw new InvalidScoreFailure(
					`Invalid difficulty '${
						resolver.difficulty
					}', Expected any of ${config.difficulties.order.join(", ")} or ANY_INF`
				);
			}

			const diff = resolver.difficulty as Difficulties["sdvx:Single"] | "ANY_INF";

			if (resolver.version) {
				if (!Object.keys(config.versions).includes(resolver.version)) {
					throw new InvalidScoreFailure(
						`Unsupported version ${resolver.version}. Expected any of ${Object.keys(
							config.versions
						).join(", ")}.`
					);
				}

				chart = await FindSDVXChartOnInGameIDVersion(
					identifier,
					diff,
					resolver.version as Versions["sdvx:Single"]
				);
			} else {
				chart = await FindSDVXChartOnInGameID(identifier, diff);
			}

			if (!chart) {
				return null;
			}

			const song = await db.anySongs[game].findOne({ id: chart.songID });

			if (!song) {
				logger.severe(`Song-Chart desync on ${chart.songID}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "inGameID": {
			const identifier = Number(resolver.identifier);

			const difficulty = AssertStrAsDifficulty(resolver.difficulty, game, resolver.playtype);

			let chart: ChartDocument | null | undefined;

			if (resolver.version) {
				chart = await db.anyCharts[game].findOne({
					"data.inGameID": identifier,
					playtype: resolver.playtype,
					difficulty,
					versions: resolver.version,
				});
			} else {
				chart = await db.anyCharts[game].findOne({
					"data.inGameID": identifier,
					playtype: resolver.playtype,
					difficulty,
					isPrimary: true,
				});
			}

			if (!chart) {
				return null;
			}

			const song = await db.anySongs[game].findOne({ id: chart.songID });

			if (!song) {
				logger.severe(`Song-Chart desync on ${chart.songID}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "inGameStrID": {
			const difficulty = AssertStrAsDifficulty(resolver.difficulty, game, resolver.playtype);

			let chart;

			if (resolver.version) {
				chart = await db.anyCharts[game].findOne({
					"data.inGameStrID": resolver.identifier,
					playtype: resolver.playtype,
					difficulty,
					versions: resolver.version,
				});
			} else {
				chart = await db.anyCharts[game].findOne({
					"data.inGameStrID": resolver.identifier,
					playtype: resolver.playtype,
					difficulty,
					isPrimary: true,
				});
			}

			if (!chart) {
				return null;
			}

			const song = await db.anySongs[game].findOne({ id: chart.songID });

			if (!song) {
				logger.severe(`Song-Chart desync on ${chart.songID}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "uscChartHash": {
			if (game !== "usc") {
				throw new InvalidScoreFailure(`uscChartHash matchType can only be used on USC.`);
			}

			if (playtype !== "Controller" && playtype !== "Keyboard") {
				throw new InvalidScoreFailure(`Invalid playtype, expected Keyboard or Controller.`);
			}

			const chart = await db.charts.usc.findOne({
				"data.hashSHA1": resolver.identifier,
				playtype,
			});

			if (!chart) {
				return null;
			}

			const song = await db.anySongs[game].findOne({ id: chart.songID });

			if (!song) {
				logger.severe(`Song-Chart desync on ${chart.songID}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "ddrSongHash": {
			if (game !== "ddr") {
				throw new InvalidScoreFailure(`ddrSongHash matchType can only be used on DDR.`);
			}

			const difficulty = AssertStrAsDifficulty(resolver.difficulty, game, resolver.playtype);

			const song = await db.anySongs.ddr.findOne({
				"data.ddrSongHash": resolver.identifier,
			});

			if (!song) {
				return null;
			}

			// check that a chart with the song's id exists
			const chartSync = await db.anyCharts.ddr.findOne({
				songID: song.id,
			});

			if (!chartSync) {
				logger.severe(`Song-Chart desync on ${song.id}.`);
				throw new InternalFailure(`Failed to get chart for a song that exists.`);
			}

			let chart;

			if (resolver.version) {
				chart = await db.anyCharts.ddr.findOne({
					songID: song.id,
					playtype: resolver.playtype,
					difficulty,
					versions: resolver.version,
				});
			} else {
				chart = await db.anyCharts.ddr.findOne({
					songID: song.id,
					playtype: resolver.playtype,
					difficulty,
					isPrimary: true,
				});
			}

			if (!chart) {
				return null;
			}

			return { song, chart };
		}

		default: {
			const { matchType } = resolver;

			logger.error(
				`Invalid matchType ${matchType} ended up in conversion - should have been rejected by prudence?`
			);

			// really, this could be a larger error. - it's an internal failure because prudence should reject this.
			throw new InvalidScoreFailure(`Invalid matchType ${matchType}.`);
		}
	}
}

export async function ResolveChartFromSong(
	song: SongDocument,
	resolver: MatchTypeResolverWithDifficulty
) {
	const game = resolver.game;

	if (!resolver.difficulty) {
		throw new InvalidScoreFailure(
			`Missing 'difficulty' field, but was necessary for this lookup.`
		);
	}

	const difficulty = AssertStrAsDifficulty(resolver.difficulty, game, resolver.playtype);

	let chart;

	if (resolver.version) {
		chart = await FindChartWithPTDFVersion(
			game,
			song.id,
			resolver.playtype,
			difficulty,
			resolver.version
		);
	} else {
		chart = await FindChartWithPTDF(game, song.id, resolver.playtype, difficulty);
	}

	if (!chart) {
		return null;
	}

	return chart;
}
