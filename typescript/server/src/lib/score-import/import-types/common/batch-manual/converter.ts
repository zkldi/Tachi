import type { KtLogger } from "#lib/log/log";
import type { DryScore } from "#lib/score-import/framework/common/types";

import {
	InternalFailure,
	InvalidScoreFailure,
	SongOrChartNotFoundFailure,
} from "#lib/score-import/framework/common/converter-failures";
import { AssertStrAsDifficulty } from "#lib/score-import/framework/common/string-asserts";
import ScoreImportFatalError from "#lib/score-import/framework/score-importing/score-import-error";
import {
	IsEnabledGame,
	IsEnabledGameGroup,
	IsValidPlaytype,
	staticAssertUnreachable,
} from "#utils/misc";
import {
	FindBMSChartOnHash,
	FindChartOnInGameIDIfUnique,
	FindChartOnInGameIDPrimary,
	FindChartOnInGameIDVersion,
	FindChartOnInGameStrIDPrimary,
	FindChartOnInGameStrIDVersion,
	FindChartWithSongDifficulty,
	FindChartWithSongDifficultyVersion,
	FindITGChartOnHash,
	FindOngekiChartOnInGameID,
	FindOngekiChartWithSongDifficulty,
	FindPopnChartOnHashSHA256,
	FindSDVXChartOnInGameID,
	FindSDVXChartOnInGameIDVersion,
	FindUSCChartOnSHA1,
	SongHasAnyChart,
} from "#utils/queries/charts";
import {
	FindDDRSongOnDDRSongHash,
	FindSongOnID,
	FindSongOnTitleInsensitive,
} from "#utils/queries/songs";
import {
	type BatchManualScore,
	type ChartDocument,
	type Difficulties,
	FormatGame,
	GameToGameGroup,
	GetGameConfig,
	LEGACY_GameGroupPTToGame,
	type MatchTypeResolver,
	type MatchTypeResolverWithDifficulty,
	type MongoProvidedMetrics,
	type SongDocument,
	type Versions,
} from "tachi-common";

import type { ConverterFunction } from "../types";
import type { BatchManualContext } from "./types";

/**
 * Some stored orphan rows (and other legacy payloads) put a {@link GameGroup}
 * in `context.game` and the legacy playtype in `context.playtype`. Current
 * imports set `context.game` to a {@link V3Game} directly.
 */
function ResolveBatchManualV3Game(context: BatchManualContext): BatchManualContext["game"] {
	if (IsEnabledGame(context.game)) {
		return context.game;
	}

	const playtype = (context as { playtype?: unknown } & BatchManualContext).playtype;

	if (
		IsEnabledGameGroup(context.game) &&
		typeof playtype === "string" &&
		IsValidPlaytype(context.game, playtype)
	) {
		return LEGACY_GameGroupPTToGame(context.game, playtype);
	}

	throw new InternalFailure(
		`Legacy batch-manual context could not be resolved to a V3 game (game=${JSON.stringify(
			context.game,
		)}, playtype=${JSON.stringify(
			(context as { playtype?: unknown } & BatchManualContext).playtype,
		)}).`,
	);
}

// only public because used in tests; ts has no way of doing that
// lol
export function BatchManualScoreToResolver(
	data: BatchManualScore,
	context: BatchManualContext,
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
	log,
) => {
	const game = ResolveBatchManualV3Game(context);
	const contextWithV3Game: BatchManualContext = { ...context, game };

	const resolver = BatchManualScoreToResolver(data, contextWithV3Game);

	const got = await ResolveSongAndChart(resolver, log);

	if (got === null) {
		throw new SongOrChartNotFoundFailure(
			`Cannot find chart ${resolver.matchType}:${resolver.identifier}.`,
			importType,
			data,
			context,
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
	const metrics: MongoProvidedMetrics[V3Game] = {};

	const gameConfig = GetGameConfig(game);

	for (const key of Object.keys(gameConfig.providedMetrics)) {
		// @ts-expect-error hacky type messery
		metrics[key] = data[key];
	}

	const dryScore: DryScore = {
		game,
		service,
		comment: data.comment ?? null,
		importType,

		// For backwards compatibility reasons, an explicitly passed timeAchieved of 0 should be interpreted as null.
		timeAchieved: data.timeAchieved === 0 ? null : (data.timeAchieved ?? null),
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
	log: KtLogger,
): Promise<{ chart: ChartDocument; song: SongDocument } | null> {
	const { game } = resolver;
	const gameGroup = GameToGameGroup(game);

	const gameConfig = GetGameConfig(game);

	if (!gameConfig.supportedMatchTypes.includes(resolver.matchType)) {
		// special, more helpful error message
		if (game === "sdvx" && resolver.matchType === "inGameID") {
			throw new InvalidScoreFailure(
				`Cannot use matchType ${resolver.matchType} for ${FormatGame(
					game,
				)}. Use 'sdvxInGameID' instead.`,
			);
		}

		throw new InvalidScoreFailure(
			`Cannot use matchType ${resolver.matchType} for ${FormatGame(
				game,
			)}. Expected any of ${gameConfig.supportedMatchTypes.join(", ")}.`,
		);
	}

	const matchType = resolver.matchType;
	switch (matchType) {
		case "bmsChartHash": {
			const chart = await FindBMSChartOnHash(resolver.identifier);

			if (!chart) {
				return null;
			}

			if (chart.game !== game) {
				throw new InvalidScoreFailure(
					`Chart ${chart.chartID}'s game was ${chart.game}, but this was not equal to the resolver game of ${game}.`,
				);
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`BMS songID ${chart.song.id} has charts but no parent song.`);
				throw new InternalFailure(
					`BMS songID ${chart.song.id} has charts but no parent song.`,
				);
			}

			return { chart, song };
		}

		case "itgChartHash": {
			const chart = await FindITGChartOnHash(resolver.identifier);

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`ITG songID ${chart.song.id} has charts but no parent song.`);
				throw new InternalFailure(
					`ITG songID ${chart.song.id} has charts but no parent song.`,
				);
			}

			return { song, chart };
		}

		case "popnChartHash": {
			if (game !== "popn") {
				throw new InvalidScoreFailure(`Invalid game '${game}', expected popn.`);
			}

			const chart = await FindPopnChartOnHashSHA256(resolver.identifier);

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`Pop'n songID ${chart.song.id} has charts but no parent song.`);
				throw new InternalFailure(
					`Pop'n songID ${chart.song.id} has charts but no parent song.`,
				);
			}

			return { song, chart };
		}

		case "tachiSongID": {
			const song = await FindSongOnID(gameGroup, resolver.identifier);

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
				gameGroup,
				resolver.identifier,
				resolver.artist,
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

			const config = GetGameConfig("sdvx");

			if (config.difficulties.type === "DYNAMIC") {
				log.error(
					{
						config,
					},
					`SDVX has 'DYNAMIC' difficulties set. This is completely unexpected.`,
				);
				throw new ScoreImportFatalError(
					500,
					`SDVX has 'DYNAMIC' difficulties set. This is completely unexpected.`,
				);
			}

			if (
				!config.difficulties.order.includes(resolver.difficulty) &&
				resolver.difficulty !== "ANY_INF"
			) {
				throw new InvalidScoreFailure(
					`Invalid difficulty '${
						resolver.difficulty
					}', Expected any of ${config.difficulties.order.join(", ")} or ANY_INF`,
				);
			}

			const diff = resolver.difficulty as "ANY_INF" | Difficulties["sdvx"];

			if (resolver.version) {
				if (!Object.keys(config.versions).includes(resolver.version)) {
					throw new InvalidScoreFailure(
						`Unsupported version ${resolver.version}. Expected any of ${Object.keys(
							config.versions,
						).join(", ")}.`,
					);
				}

				chart = await FindSDVXChartOnInGameIDVersion(
					identifier,
					diff,
					resolver.version as Versions["sdvx"],
				);
			} else {
				chart = await FindSDVXChartOnInGameID(identifier, diff);
			}

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID("sdvx", chart.song.id);

			if (!song) {
				log.error(`Song-Chart desync on ${chart.song.id}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "inGameID": {
			const identifier = Number(resolver.identifier);

			const difficulty = AssertStrAsDifficulty(resolver.difficulty, game);

			let chart: ChartDocument | null;

			if (resolver.version) {
				chart = await FindChartOnInGameIDVersion(
					game,
					identifier,
					difficulty,
					resolver.version,
				);
			} else {
				if (game === "ongeki") {
					chart = await FindOngekiChartOnInGameID(game, identifier, difficulty);
				} else {
					chart = await FindChartOnInGameIDPrimary(game, identifier, difficulty);
				}
			}

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`Song-Chart desync on ${chart.song.id}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "inGameStrID": {
			const difficulty = AssertStrAsDifficulty(resolver.difficulty, game);

			let chart: ChartDocument | null;

			if (resolver.version) {
				chart = await FindChartOnInGameStrIDVersion(
					game,
					resolver.identifier,
					difficulty,
					resolver.version,
				);
			} else {
				chart = await FindChartOnInGameStrIDPrimary(game, resolver.identifier, difficulty);
			}

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`Song-Chart desync on ${chart.song.id}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "uscChartHash": {
			if (gameGroup !== "usc") {
				throw new InvalidScoreFailure(`uscChartHash matchType can only be used on USC.`);
			}

			if (game !== "usc-controller" && game !== "usc-keyboard") {
				throw new InvalidScoreFailure(`Invalid playtype, expected Keyboard or Controller.`);
			}

			const chart = await FindUSCChartOnSHA1(resolver.identifier, game);

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`Song-Chart desync on ${chart.song.id}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "gcmInGameIDSpecialChart": {
			const gcmGames = ["chunithm", "maimai", "maimaidx"] as const;
			if (!gcmGames.includes(game as (typeof gcmGames)[number])) {
				throw new InvalidScoreFailure(
					`gcmInGameIDSpecialChart matchType can only be used on CHUNITHM, maimai, or maimai DX.`,
				);
			}

			const inGameID = Number(resolver.identifier);

			const chart = await FindChartOnInGameIDIfUnique(game, inGameID);

			if (!chart) {
				return null;
			}

			const song = await FindSongOnID(gameGroup, chart.song.id);

			if (!song) {
				log.error(`Song-Chart desync on ${chart.song.id}.`);
				throw new InternalFailure(`Failed to get song for a chart that exists.`);
			}

			return { song, chart };
		}

		case "ddrSongHash": {
			if (gameGroup !== "ddr") {
				throw new InvalidScoreFailure(`ddrSongHash matchType can only be used on DDR.`);
			}

			const difficulty = AssertStrAsDifficulty(resolver.difficulty, game);

			const song = await FindDDRSongOnDDRSongHash(resolver.identifier);

			if (!song) {
				return null;
			}

			if (!(await SongHasAnyChart("ddr", song.id))) {
				log.error(`Song-Chart desync on ${song.id}.`);
				throw new InternalFailure(`Failed to get chart for a song that exists.`);
			}

			let chart: ChartDocument | null;

			if (resolver.version) {
				chart = await FindChartWithSongDifficultyVersion(
					game,
					song.id,
					difficulty,
					resolver.version as Versions["ddr-dp" | "ddr-sp"],
				);
			} else {
				chart = await FindChartWithSongDifficulty(game, song.id, difficulty);
			}

			if (!chart) {
				return null;
			}

			return { song, chart };
		}

		default: {
			staticAssertUnreachable(matchType);
		}
	}
}

export async function ResolveChartFromSong(
	song: SongDocument,
	resolver: MatchTypeResolverWithDifficulty,
) {
	const game = resolver.game;

	if (!resolver.difficulty) {
		throw new InvalidScoreFailure(
			`Missing 'difficulty' field, but was necessary for this lookup.`,
		);
	}

	const difficulty = AssertStrAsDifficulty(resolver.difficulty, game);

	const gameConfig = GetGameConfig(resolver.game);
	switch (gameConfig.difficulties.type) {
		case "DYNAMIC":
			throw new InvalidScoreFailure(
				"You cannot use a songTitle+difficulty lookup for a game with 'DYNAMIC' difficulties",
			);
		case "CHUGEKIMAI_STYLE":
			if (!gameConfig.difficulties.order.includes(difficulty)) {
				throw new InvalidScoreFailure(
					`This difficulty "${difficulty}" is not supported for songTitle+difficulty lookups. If you are trying to import for WORLD'S END/UTAGE scores, you must use inGameID, or a different lookup method.`,
				);
			}
			break;
		case "FIXED":
			break;
	}

	let chart;

	if (resolver.version) {
		chart = await FindChartWithSongDifficultyVersion(
			game,
			song.id,
			difficulty,
			resolver.version,
		);
	} else {
		if (game === "ongeki") {
			chart = await FindOngekiChartWithSongDifficulty(game, song.id, difficulty);
		} else {
			chart = await FindChartWithSongDifficulty(game, song.id, difficulty);
		}
	}

	if (!chart) {
		return null;
	}

	return chart;
}
