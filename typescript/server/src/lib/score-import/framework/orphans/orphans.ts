import type { KtLogger } from "#lib/log/log";
import type {
	ConverterFnReturnOrFailure,
	ConverterFunction,
	ImportTypeContextMap,
	ImportTypeDataMap,
	OrphanScoreDocument,
} from "#lib/score-import/import-types/common/types";
import type { OrphanScore as PgOrphanScoreRow } from "tachi-db";

import { SELECT_ORPHAN_SCORE } from "#lib/db-formats/orphan-score";
import { SendNotification } from "#lib/notifications/notifications";
import { Converters } from "#lib/score-import/import-types/converters";
import DB from "#services/pg/db";
import { GetBlacklist } from "#utils/queries/blacklist";
import { GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";
import fjsh from "fast-json-stable-hash";
import { sql } from "kysely";
import { type GameGroup, GetGameGroupConfig, type ImportTypes, type integer } from "tachi-common";

import { type ConverterFailure, IsConverterFailure } from "../common/converter-failures";
import { HandlePostImportSteps } from "../score-importing/score-import-main";
import { ProcessSuccessfulConverterReturn } from "../score-importing/score-importing";

export type DeorphanScoresFilter = {
	/** Beatoraja: match `context.chart.sha256` (import_type forced to ir/beatoraja). */
	chartSha256?: string;
	pmsPlaytype?: "Controller" | "Keyboard";
	userID?: integer;
};

function pgOrphanRowToDocument(row: PgOrphanScoreRow): OrphanScoreDocument {
	return {
		orphanID: row.orphan_id,
		userID: row.user_id,
		importType: row.import_type as ImportTypes,
		game: row.game_group as GameGroup,
		data: row.data as OrphanScoreDocument["data"],
		context: row.context as OrphanScoreDocument["context"],
		errMsg: row.error_message.length > 0 ? row.error_message : null,
		timeInserted: new Date(row.time_inserted).getTime(),
	};
}

async function deleteOrphanByOrphanId(orphanID: string): Promise<void> {
	await DB.deleteFrom("orphan_score").where("orphan_score.orphan_id", "=", orphanID).execute();
}

/** API-facing row for listing a user’s orphan_score entries. */
export type OrphanScoreListItem = {
	gameGroup: string;
	importType: string;
	message: string | null;
	orphanID: string;
	rowID: string;
	summary: string | null;
	timeInserted: number;
};

/** API-facing detail for one orphan_score row (includes raw import payload). */
export type OrphanScoreDetail = {
	context: unknown;
	data: unknown;
	gameGroup: string;
	importType: string;
	message: string | null;
	orphanID: string;
	timeInserted: number;
};

/** @internal Exported for unit tests only. */
export function summarizeOrphanRow(row: Pick<PgOrphanScoreRow, "context" | "data">): string | null {
	let primary: string | null = null;
	let artist: string | null = null;
	let difficulty: string | null = null;

	const data = row.data;
	if (data && typeof data === "object") {
		const d = data as Record<string, unknown>;
		for (const k of ["identifier", "title", "songTitle", "hashSHA256", "sha256"] as const) {
			const v = d[k];
			if (typeof v === "string" && v.length > 0) {
				primary = v;
				break;
			}
		}
		const a = d.artist;
		if (typeof a === "string" && a.length > 0) {
			artist = a;
		}
		const diff = d.difficulty;
		if (typeof diff === "string" && diff.length > 0) {
			difficulty = diff;
		}
	}

	const ctx = row.context;
	if (ctx && typeof ctx === "object") {
		const c = ctx as Record<string, unknown>;
		if (primary === null) {
			for (const k of ["title", "identifier"] as const) {
				const v = c[k];
				if (typeof v === "string" && v.length > 0) {
					primary = v;
					break;
				}
			}
		}
		const chart = c.chart;
		if (chart && typeof chart === "object") {
			const chartObj = chart as Record<string, unknown>;
			if (primary === null) {
				const sha = chartObj.sha256;
				if (typeof sha === "string" && sha.length > 0) {
					primary = `sha256:${sha.slice(0, 16)}...`;
				}
			}
			// beatoraja stores artist on context.chart
			if (artist === null) {
				const a = chartObj.artist;
				if (typeof a === "string" && a.length > 0) {
					artist = a;
				}
			}
		}
	}

	if (primary === null) {
		return null;
	}

	const extras: string[] = [];
	if (artist !== null) {
		extras.push(artist);
	}
	if (difficulty !== null) {
		extras.push(difficulty);
	}

	if (extras.length === 0) {
		return primary.length > 120 ? `${primary.slice(0, 117)}...` : primary;
	}

	// Truncate primary to 80 chars to leave room for extras within the 120-char budget.
	const primaryTrunc = primary.length > 80 ? `${primary.slice(0, 77)}...` : primary;
	const combined = `${primaryTrunc} (${extras.join(" · ")})`;
	return combined.length > 120 ? `${combined.slice(0, 117)}...` : combined;
}

function orphanRowToListItem(row: PgOrphanScoreRow): OrphanScoreListItem {
	const msg = row.error_message.trim();
	return {
		orphanID: row.orphan_id,
		rowID: row.row_id,
		importType: row.import_type,
		gameGroup: row.game_group,
		timeInserted: new Date(row.time_inserted).getTime(),
		message: msg.length > 0 ? msg : null,
		summary: summarizeOrphanRow(row),
	};
}

/** Loads one orphan_score row for the user, or null if none. */
export async function getOrphanScoreDetailForUser(
	orphanID: string,
	userID: integer,
): Promise<OrphanScoreDetail | null> {
	const row = await DB.selectFrom("orphan_score")
		.select(SELECT_ORPHAN_SCORE)
		.where("orphan_score.orphan_id", "=", orphanID)
		.where("orphan_score.user_id", "=", userID)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	const msg = row.error_message.trim();
	return {
		orphanID: row.orphan_id,
		importType: row.import_type,
		gameGroup: row.game_group,
		timeInserted: new Date(row.time_inserted).getTime(),
		message: msg.length > 0 ? msg : null,
		data: row.data,
		context: row.context,
	};
}

/** Deletes one orphan_score row if it belongs to the given user. Returns whether a row was removed. */
export async function deleteOrphanScoreForUser(
	orphanID: string,
	userID: integer,
): Promise<boolean> {
	const result = await DB.deleteFrom("orphan_score")
		.where("orphan_score.orphan_id", "=", orphanID)
		.where("orphan_score.user_id", "=", userID)
		.executeTakeFirst();

	return Number(result.numDeletedRows ?? 0n) > 0;
}

/**
 * Lists orphan_score rows for a user, newest first, with keyset pagination on `row_id` + `time_inserted`.
 * @param afterRowID - `row_id` of the last item from the previous page (omit on first page).
 */
export async function listOrphanScoresForUser(opts: {
	afterRowID?: string;
	limit: number;
	userID: integer;
}): Promise<{ hasMore: boolean; orphans: OrphanScoreListItem[] }> {
	const cap = Math.min(Math.max(opts.limit, 1), 100);
	let anchor: { row_id: string; time_inserted: string } | undefined;

	if (opts.afterRowID !== undefined && opts.afterRowID.length > 0) {
		anchor = await DB.selectFrom("orphan_score")
			.select(["orphan_score.time_inserted", "orphan_score.row_id"])
			.where("orphan_score.user_id", "=", opts.userID)
			.where("orphan_score.row_id", "=", opts.afterRowID)
			.executeTakeFirst();

		if (anchor === undefined) {
			throw new ExpectedErr(400, "Invalid pagination cursor.");
		}
	}

	let q = DB.selectFrom("orphan_score")
		.select(SELECT_ORPHAN_SCORE)
		.where("orphan_score.user_id", "=", opts.userID)
		.orderBy("orphan_score.time_inserted", "desc")
		.orderBy("orphan_score.row_id", "desc")
		.limit(cap + 1);

	if (anchor !== undefined) {
		const anchorRow = anchor;
		q = q.where((eb) =>
			eb.or([
				eb("orphan_score.time_inserted", "<", anchorRow.time_inserted),
				eb.and([
					eb("orphan_score.time_inserted", "=", anchorRow.time_inserted),
					eb("orphan_score.row_id", "<", anchorRow.row_id),
				]),
			]),
		);
	}

	const rows = await q.execute();
	const hasMore = rows.length > cap;
	const slice = hasMore ? rows.slice(0, cap) : rows;
	return {
		orphans: slice.map(orphanRowToListItem),
		hasMore,
	};
}

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
	game: GameGroup,
	log: KtLogger,
	importId: string,
) {
	const orphan: Pick<OrphanScoreDocument, "context" | "data" | "importType" | "userID"> = {
		importType,
		data,
		context,
		userID,
	};

	log.debug(orphan, "Orphaning document");

	let orphanID: string;

	try {
		orphanID = `O${fjsh.hash(orphan, "sha256")}`;
	} catch (err) {
		log.error({ err, orphan }, `Failed to orphan score -- `);
		throw new Error(`Failed to orphan score. ${(err as Error).message}`);
	}

	const inserted = await DB.insertInto("orphan_score")
		.values({
			orphan_id: orphanID,
			user_id: userID,
			import_id: importId,
			import_type: importType,
			game_group: game,
			data,
			context,
			time_inserted: new Date().toISOString(),
			error_message: errMsg ?? "",
		})
		.onConflict((oc) => oc.column("orphan_id").doNothing())
		.returning("orphan_id")
		.executeTakeFirst();

	if (!inserted) {
		log.debug(`Skipped orphaning score ${orphanID} because it already exists.`);
		return { success: false, orphanID };
	}

	log.debug({ orphanID }, `Inserted orphan_score row.`);

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
	log: KtLogger,
) {
	const ConverterFunction = Converters[orphan.importType] as ConverterFunction<
		ImportTypeDataMap[ImportTypes],
		ImportTypeContextMap[ImportTypes]
	>;

	let res: ConverterFnReturnOrFailure;

	try {
		res = await ConverterFunction(orphan.data, orphan.context, orphan.importType, log);
	} catch (e) {
		const err = e as ConverterFailure | Error;

		// this is impossible to test, so we're going to ignore it
		/* istanbul ignore next */
		if (!("failureType" in err)) {
			log.error(
				{
					err,
					orphan,
				},
				`Converter function ${orphan.importType} returned unexpected error. ID=${orphan.orphanID}`,
			);

			// throw this higher up, i guess.
			throw err;
		}

		res = err;
	}

	if ("failureType" in res) {
		// If the data still can't be found, we do nothing about it.
		if (res.failureType === "SongOrChartNotFound") {
			log.debug(`Unorphaning ${orphan.orphanID} failed. (${res.message})`);
			return false;
		} else if (res.failureType === "Internal") {
			log.error(`Orphan Internal Failure - ${res.message}, OrphanID ${orphan.orphanID}`);

			return false;
		}

		// otherwise, it's another converterfailure we don't need to specifically handle.
		log.warn(
			`received ConverterFailure ${res.message} on orphan ${orphan.orphanID}. Removing orphan.`,
		);

		// @danger - This could go terribly, if there's a mistake in the converterFN we might accidentally
		// remove a users score.
		await deleteOrphanByOrphanId(orphan.orphanID);

		return null;
	}

	// else, import the orphan.

	let converterReturns;

	try {
		converterReturns = await ProcessSuccessfulConverterReturn(
			orphan.userID,
			res,
			blacklist,
			log,
			null,
			{ forceImmediateImport: true, directCommit: true },
		);
	} catch (err) {
		if (IsConverterFailure(err) && err.failureType === "InvalidScore") {
			await deleteOrphanByOrphanId(orphan.orphanID);
			return null;
		}

		// Deliberately do not delete the orphan here, so the orphaned score
		// can be inspected for errors.
		throw err;
	}

	if (converterReturns === null || !converterReturns.success) {
		await deleteOrphanByOrphanId(orphan.orphanID);
		return null;
	}

	const user = await GetUserWithID(orphan.userID);

	if (!user) {
		log.error(
			`Orphan ${orphan.orphanID} belongs to ${orphan.userID}, but that user no longer exists in the database. Going to skip this and remove the orphan.`,
		);
		await deleteOrphanByOrphanId(orphan.orphanID);
		return null;
	}

	await HandlePostImportSteps(
		[converterReturns],
		user,
		orphan.importType,
		orphan.game,
		null,
		log,
		undefined,
		"",
	);

	await deleteOrphanByOrphanId(orphan.orphanID);
	return converterReturns;
}

export async function DeorphanScores(filter: DeorphanScoresFilter, log: KtLogger) {
	let q = DB.selectFrom("orphan_score").select(SELECT_ORPHAN_SCORE);

	if (filter.userID !== undefined) {
		q = q.where("orphan_score.user_id", "=", filter.userID);
	}

	if (filter.chartSha256 !== undefined) {
		q = q
			.where("orphan_score.import_type", "=", "ir/beatoraja")
			.where(
				sql<boolean>`(orphan_score.context::jsonb->'chart'->>'sha256') = ${filter.chartSha256}`,
			);

		if (filter.pmsPlaytype !== undefined) {
			if (filter.pmsPlaytype === "Controller") {
				q = q.where(
					sql<boolean>`(orphan_score.data::jsonb->>'deviceType') = ${"BM_CONTROLLER"}`,
				);
			} else {
				q = q.where(
					sql<boolean>`(orphan_score.data::jsonb->>'deviceType') IS DISTINCT FROM ${"BM_CONTROLLER"}`,
				);
			}
		}
	}

	const rows = await q.execute();
	const orphans = rows.map(pgOrphanRowToDocument);

	// ScoreIDs are essentially userID dependent, so this is fine.
	// TODO(zk): Gooood the performance of this is shit, what the fuck man.
	const blacklist = await GetBlacklist();

	log.info({ filter }, `Found ${orphans.length} orphans.`);

	let failed = 0;
	let success = 0;
	let removed = 0;
	let processed = 0;

	const restoredScoreCountByUser = new Map<integer, integer>();

	for (const or of orphans) {
		// We have to await like this to avoid mid-air race conditions,
		// where two orphans attempt to deorphan to the same scoreID
		// at the same time.
		// See #511.

		processed++;

		try {
			// eslint-disable-next-line no-await-in-loop
			const r = await ReprocessOrphan(or, blacklist, log);

			if (r === null) {
				removed++;
			} else if (r === false) {
				failed++;
			} else {
				success++;
				if (!GetGameGroupConfig(or.game).dynamicContent) {
					restoredScoreCountByUser.set(
						or.userID,
						(restoredScoreCountByUser.get(or.userID) ?? 0) + 1,
					);
				}
			}
		} catch (err) {
			log.error({ orphanID: or.orphanID, err }, `Failed to reprocess orphan.`);
			failed++;
		}
	}

	await Promise.all(
		[...restoredScoreCountByUser.entries()].map(([userID, scoreCount]) => {
			const title = `We've added new song data to the site, and ${scoreCount} of your scores have now been resolved to your profile.`;

			return SendNotification(title, userID, {
				type: "ORPHANS_RESTORED",
				content: { scoreCount },
			});
		}),
	);

	return { processed, removed, failed, success };
}
