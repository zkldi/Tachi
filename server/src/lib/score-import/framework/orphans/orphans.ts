import { Converters } from "../../import-types/converters";
import { IsConverterFailure } from "../common/converter-failures";
import { HandlePostImportSteps } from "../score-importing/score-import-main";
import { ProcessSuccessfulConverterReturn } from "../score-importing/score-importing";
import db from "external/mongo/db";
import fjsh from "fast-json-stable-hash";
import { GetBlacklist } from "utils/queries/blacklist";
import { GetUserWithID } from "utils/user";
import type {
	ConverterFnReturnOrFailure,
	ConverterFunction,
	ImportTypeContextMap,
	ImportTypeDataMap,
	OrphanScoreDocument,
} from "../../import-types/common/types";
import type { ConverterFailure } from "../common/converter-failures";
import type { KtLogger } from "lib/logger/logger";
import type { FilterQuery } from "mongodb";
import type { Game, ImportTypes, integer } from "tachi-common";

/**
 * Creates an OrphanedScore document from the data and context,
 * and inserts it into the DB if it is not already in there.
 *
 * @returns Returns { success: true | false, orphanID }
 */
export async function OrphanScore<T extends ImportTypes = ImportTypes>(
	importType: T,
	userID: integer,
	data: ImportTypeDataMap[T],
	context: ImportTypeContextMap[T],
	errMsg: string | null,
	game: Game,
	logger: KtLogger
) {
	const orphan: Pick<OrphanScoreDocument, "context" | "data" | "importType" | "userID"> = {
		importType,
		data,
		context,
		userID,
	};

	logger.debug("Orphaning document", orphan);

	let orphanID;

	try {
		orphanID = `O${fjsh.hash(orphan, "sha256")}`;
	} catch (err) {
		logger.error(`Failed to orphan score -- `, { err, orphan });
		throw new Error(`Failed to orphan score. ${(err as Error).message}`);
	}

	const exists = await db["orphan-scores"].findOne({ orphanID });

	if (exists) {
		logger.debug(`Skipped orphaning score ${orphanID} because it already exists.`);
		return { success: false, orphanID };
	}

	const orphanScoreDoc: OrphanScoreDocument = {
		...orphan,
		orphanID,
		game,
		errMsg,
		timeInserted: Date.now(),
	};

	logger.debug(`Inserting orphanScoreDoc...`, orphanScoreDoc);

	await db["orphan-scores"].insert(orphanScoreDoc);

	return { success: true, orphanID };
}

/**
 * Takes an orphan document and re-runs the converter->scoreimport pipeline on its data.
 *
 * @returns False if no parent documents could be found for the score again,
 * Null if the orphan document was removed, but no score was inserted (i.e. score was orphaned AND invalid, so nothing
 * could be imported when parents were found).
 * ImportProcessingInfo on success.
 */
export async function ReprocessOrphan(
	orphan: OrphanScoreDocument,
	blacklist: Array<string>,
	logger: KtLogger
) {
	const ConverterFunction = Converters[orphan.importType] as ConverterFunction<
		ImportTypeDataMap[ImportTypes],
		ImportTypeContextMap[ImportTypes]
	>;

	let res: ConverterFnReturnOrFailure;

	try {
		res = await ConverterFunction(orphan.data, orphan.context, orphan.importType, logger);
	} catch (e) {
		const err = e as ConverterFailure | Error;

		// this is impossible to test, so we're going to ignore it
		/* istanbul ignore next */
		if (!("failureType" in err)) {
			logger.error(
				`Converter function ${orphan.importType} returned unexpected error. ID=${orphan.orphanID}`,
				{
					err,
					orphan,
				}
			);

			// throw this higher up, i guess.
			throw err;
		}

		res = err;
	}

	if ("failureType" in res) {
		// If the data still can't be found, we do nothing about it.
		if (res.failureType === "SongOrChartNotFound") {
			logger.debug(`Unorphaning ${orphan.orphanID} failed. (${res.message})`);
			return false;
		} else if (res.failureType === "Internal") {
			logger.error(`Orphan Internal Failure - ${res.message}, OrphanID ${orphan.orphanID}`);

			return false;
		}

		// otherwise, it's another converterfailure we don't need to specifically handle.
		logger.warn(
			`received ConverterFailure ${res.message} on orphan ${orphan.orphanID}. Removing orphan.`
		);

		// @danger - This could go terribly, if there's a mistake in the converterFN we might accidentally
		// remove a users score.
		await db["orphan-scores"].remove({ orphanID: orphan.orphanID });

		return null;
	}

	// else, import the orphan.

	let converterReturns;

	try {
		converterReturns = await ProcessSuccessfulConverterReturn(
			orphan.userID,
			res,
			blacklist,
			logger,
			true
		);
	} catch (err) {
		if (IsConverterFailure(err) && err.failureType === "InvalidScore") {
			await db["orphan-scores"].remove({ orphanID: orphan.orphanID });
			return null;
		}

		// Deliberately do not delete the orphan here, so the orphaned score
		// can be inspected for errors.
		throw err;
	}

	if (converterReturns === null || !converterReturns.success) {
		await db["orphan-scores"].remove({ orphanID: orphan.orphanID });
		return null;
	}

	const user = await GetUserWithID(orphan.userID);

	if (!user) {
		logger.severe(
			`Orphan ${orphan.orphanID} belongs to ${orphan.userID}, but that user no longer exists in the database. Going to skip this and remove the orphan.`
		);
		await db["orphan-scores"].remove({ orphanID: orphan.orphanID });
		return null;
	}

	await HandlePostImportSteps(
		[converterReturns],
		user,
		orphan.importType,
		orphan.game,
		null,
		logger,
		undefined
	);

	await db["orphan-scores"].remove({ orphanID: orphan.orphanID });
	return converterReturns;
}

export async function DeorphanScores(query: FilterQuery<OrphanScoreDocument>, logger: KtLogger) {
	const orphans = await db["orphan-scores"].find(query);

	// ScoreIDs are essentially userID dependent, so this is fine.
	const blacklist = await GetBlacklist();

	logger.info(`Found ${orphans.length} orphans.`, { query });

	let failed = 0;
	let success = 0;
	let removed = 0;
	let processed = 0;

	for (const or of orphans) {
		// We have to await like this to avoid mid-air race conditions,
		// where two orphans attempt to deorphan to the same scoreID
		// at the same time.
		// See #511.

		processed++;

		try {
			// eslint-disable-next-line no-await-in-loop
			const r = await ReprocessOrphan(or, blacklist, logger);

			if (r === null) {
				removed++;
			} else if (r === false) {
				failed++;
			} else {
				success++;
			}
		} catch (err) {
			logger.error(`Failed to reprocess orphan.`, { orphanID: or.orphanID, err });
			failed++;
		}
	}

	return { processed, removed, failed, success };
}
