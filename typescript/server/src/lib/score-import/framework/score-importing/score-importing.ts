import type {
	ConverterFnSuccessReturn,
	ConverterFunction,
} from "#lib/score-import/import-types/common/types";
import type { ScoreImportJob } from "#lib/score-import/worker/types";

import { AppendLogCtx, type KtLogger } from "#lib/log/log";
import { mongoScoreDocumentToNewScoreRow } from "#lib/score-import/framework/pg/mongo-score-to-pg";
import DB from "#services/pg/db";
import { ClassToObject } from "#utils/misc";
import {
	type ChartDocument,
	type GameGroup,
	type ImportProcessingInfo,
	type ImportTypes,
	type integer,
	type ScoreDocument,
	type SongDocument,
} from "tachi-common";

import type { DryScore } from "../common/types";

import {
	type AmbiguousTitleFailure,
	type ConverterFailure,
	IsConverterFailure,
	type SongOrChartNotFoundFailure,
} from "../common/converter-failures";
import { OrphanScore } from "../orphans/orphans";
import { HydrateScore } from "./hydrate-score";
import { GetScoreQueueMaybe, InsertQueue, QueueScoreInsert } from "./insert-score";
import { CreateScoreID } from "./score-id";
import { ValidateScore } from "./validate-score";

/**
 * Processes the iterable data into the Tachi database.
 * @param userID - The user this score import was for.
 * @param iterableData - The data to iterate upon.
 * @param ConverterFunction - The function needed to convert the data into an IntermediateScore
 * @param context - Any context the Converter may need in order to make decisions.
 * @returns An array of ImportProcessInfo objects.
 */
export async function ImportAllIterableData<D, C>(
	userID: integer,
	importType: ImportTypes,
	iterableData: AsyncIterable<D> | Iterable<D>,
	ConverterFunction: ConverterFunction<D, C>,
	context: C,
	game: GameGroup,
	log: KtLogger,
	job: ScoreImportJob | undefined,
	importId: string,
): Promise<Array<ImportProcessingInfo>> {
	log.debug("Getting Blacklist...");

	// @optimisable: could filter harder with score.game and score.playtype
	// stuff.
	const blacklistRows = await DB.selectFrom("score_blacklist")
		.select("score_id")
		.where("user_id", "=", userID)
		.execute();

	const blacklist = blacklistRows.map((e) => e.score_id);

	log.debug(`Starting Data Processing...`);

	const processedResults = [];

	let i = 0;

	// for await is used here as iterableData may be an async iterable
	// An example would be making an api request after exhausting
	// the first set of data.
	for await (const data of iterableData) {
		processedResults.push(
			await ImportIterableDatapoint(
				userID,
				importType,
				data,
				ConverterFunction,
				context,
				game,
				blacklist,
				log,
				importId,
			),
		);

		i++;

		if (job) {
			void job.updateProgress({ description: `Imported ${i} scores.` });
		}
	}

	// We need to filter out nulls, which we don't care for (these are neither successes or failures)

	log.debug(`Finished Importing Data (${processedResults.length} datapoints).`);
	log.debug(`Removing null returns...`);

	const datapoints = processedResults.filter((e) => e !== null) as Array<ImportProcessingInfo>;

	log.debug(`Removed null from results.`);

	log.debug(`received ${datapoints.length} returns, from ${processedResults.length} data.`);

	// Flush the score queue out after finishing most of the import. This ensures no scores get left in the
	// queue.
	const emptied = await InsertQueue(userID);

	if (emptied !== 0 && emptied !== null) {
		log.debug(`Emptied ${emptied} documents from score queue.`);
	}

	return datapoints;
}

/**
 * Processes a single data object into one or many ImportProcessingInfo objects.
 * @param userID - The user this score is from.
 * @param data - The data to process.
 * @param ConverterFunction - The processor function that takes the data and returns the partialScore(s)
 * @param context - Any context the processor might need that it can not infer from the data object.
 * @returns An array of ImportProcessingInfo objects, or a single ImportProcessingInfo object
 */
export async function ImportIterableDatapoint<D, C>(
	userID: integer,
	importType: ImportTypes,
	data: D,
	ConverterFunction: ConverterFunction<D, C>,
	context: C,
	game: GameGroup,
	blacklist: Array<string>,
	log: KtLogger,
	importId: string,
): Promise<ImportProcessingInfo | null> {
	try {
		const cfnReturn = await ConverterFunction(data, context, importType, log);

		const res = await ProcessSuccessfulConverterReturn(
			userID,
			cfnReturn,
			blacklist,
			log,
			importId,
			{},
		);

		return res;
	} catch (e) {
		const err = e as ConverterFailure | Error;

		// if this isn't a converterFailure, it's just a general error.
		// Some sort of internal issue?
		if (!IsConverterFailure(err)) {
			log.error(
				{
					err,
				},
				`Unknown error thrown from converter, Ignoring.`,
			);
			return {
				success: false,
				type: "InternalError",
				message: "An internal service error has occurred.",
				content: {},
			};
		}

		// otherwise, let's handle all the error types.
		// Originally, we handled this by using `instanceof` to check what class
		// instance the failure type was. This was neat, but typescript has some
		// questionable bugs with respect to maintaining prototype chains.
		// Even though it's uglier, we instead use a stringly-typed union.
		switch (err.failureType) {
			case "SongOrChartNotFound": {
				const dnfErr = err as SongOrChartNotFoundFailure<ImportTypes>;

				log.info(
					{
						err: ClassToObject(dnfErr),
						hideFromConsole: ["cfnReturn"],
					},
					`SongOrChartNotFoundFailure: ${dnfErr.message}`,
				);

				log.debug({ cfnReturn: dnfErr }, "Inserting orphan...");

				const insertOrphan = await OrphanScore(
					dnfErr.importType,
					userID,
					dnfErr.data,
					dnfErr.converterContext,
					dnfErr.message,
					game,
					log,
					importId,
				);

				if (insertOrphan.success) {
					log.debug(
						{
							orphanID: insertOrphan.orphanID,
						},
						"Orphan inserted successfully.",
					);
					return {
						success: false,
						type: "SongOrChartNotFound",
						message: dnfErr.message,
						content: {
							context: dnfErr.converterContext,
							data: dnfErr.data,
							orphanID: insertOrphan.orphanID,
						},
					};
				}

				log.debug({ orphanID: insertOrphan.orphanID }, `Orphan already exists.`);

				return {
					success: false,
					type: "OrphanExists",
					message: err.message,
					content: {
						orphanID: insertOrphan.orphanID,
					},
				};
			}

			case "InvalidScore": {
				log.info(
					{
						err: ClassToObject(err),
						hideFromConsole: ["cfnReturn"],
					},
					`InvalidScoreFailure: ${err.message}`,
				);
				return {
					success: false,
					type: "InvalidDatapoint",
					message: err.message,
					content: {},
				};
			}

			case "Internal": {
				log.error({ err: ClassToObject(err) }, `Internal error occurred.`);
				return {
					success: false,
					type: "InternalError",

					// could return cfnReturn.message here, but we might want to hide the details of the crash.
					message: "An internal error has occurred.",
					content: {},
				};
			}

			case "AmbiguousTitle": {
				const atErr = err as AmbiguousTitleFailure;

				log.info({ err: ClassToObject(err) }, `AmbiguousTitleFailure: ${err.message}`);

				return {
					type: "AmbiguousTitle",
					success: false,
					message: err.message,
					content: {
						title: atErr.title,
					},
				};
			}

			case "SkipScore":
				return null;

			default: {
				log.warn(
					{
						err: ClassToObject(err),
					},
					`Unknown error returned as ConverterFailure, Ignoring.`,
				);
				return {
					success: false,
					type: "InternalError",
					message: "An internal service error has occurred.",
					content: {},
				};
			}
		}
	}
}

export async function ProcessSuccessfulConverterReturn(
	userID: integer,
	cfnReturn: ConverterFnSuccessReturn,
	blacklist: Array<string>,
	log: KtLogger,
	importId: string | null,
	opts: { directCommit?: boolean; forceImmediateImport?: boolean } = {},
): Promise<ImportProcessingInfo | null> {
	const result = await HydrateCheckAndInsertScore(
		userID,
		cfnReturn.dryScore,
		cfnReturn.chart,
		cfnReturn.song,
		blacklist,
		log,
		importId,
		opts.forceImmediateImport ?? false,
		opts.directCommit ?? false,
	);

	// This used to be a ScoreExists error. However, we never actually care about
	// handling ScoreExists errors (they're nobodies issue)
	// so instead, the function will just return null, and we pass that on here.
	if (result === null) {
		return null;
	}

	log.debug(`Successfully imported score: ${result.scoreID}`);

	return {
		success: true,
		type: "ScoreImported",
		message: `Imported score ${result.scoreID}.`,
		content: {
			score: result,
		},
	};
}

/**
 * Hydrates, validates and inserts a score to the Tachi database.
 * @param userID - The user this score is from.
 * @param dryScore - The score that is to be hydrated and inserted.
 * @param chart - The chart this score is on.
 * @param song - The song this score is on.
 * @param blacklist - A list of ScoreIDs to never write to the database.
 *
 * @param force - Whether to immediately insert the score into the database
 * or not.
 */
async function HydrateCheckAndInsertScore(
	userID: integer,
	dryScore: DryScore,
	chart: ChartDocument,
	song: SongDocument,
	blacklist: Array<string>,
	importLog: KtLogger,
	importId: string | null,
	force = false,
	directCommit = false,
): Promise<ScoreDocument | null> {
	const game = dryScore.game;

	const scoreID = CreateScoreID(game, userID, dryScore, chart.legacyChartID, importLog);

	// sub-context thelog so the below logs are more accurate
	const log = AppendLogCtx(scoreID, importLog);

	if (blacklist.length && blacklist.includes(scoreID)) {
		log.debug("Skipped score, as it was on the blacklist.");
		return null;
	}

	// committed or not - don't import scores twice.
	const existing = await DB.selectFrom("score")
		.select("id")
		.where("id", "=", scoreID)
		.executeTakeFirst();

	if (existing) {
		log.debug(`Skipped score.`);
		return null;
	}

	if (GetScoreQueueMaybe(userID)?.scoreIDSet.has(scoreID) === true) {
		log.debug(`Skipped score.`);
		return null;
	}

	const score = HydrateScore(userID, dryScore, chart, song, scoreID, log);

	ValidateScore(score, chart);

	let res: number | true | null;

	const committed = directCommit;
	const effectiveImportId = directCommit ? null : importId;

	if (force) {
		try {
			await DB.insertInto("score")
				.values(
					mongoScoreDocumentToNewScoreRow(score, chart.chartID, {
						committed,
						importId: effectiveImportId,
						sessionId: null,
					}),
				)
				.execute();
			res = true;
		} catch {
			res = null;
		}
	} else {
		if (importId === null && !directCommit) {
			log.debug(`Skipped score - missing import id.`);
			return null;
		}

		res = await QueueScoreInsert(score, chart, effectiveImportId, committed);
	}

	if (res === null) {
		log.debug(`Skipped score - Race Condition protection triggered.`);
		return null;
	}

	return score;
}
