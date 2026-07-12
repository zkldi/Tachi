import type { ScoreImportJobData } from "#lib/score-import/worker/types";
import type { ImportTypes } from "tachi-common";

import { CDNStoreOrOverwrite } from "#lib/cdn/cdn";
import { GetScoreImportInputURL } from "#lib/cdn/url-format";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";

import type ScoreImportFatalError from "../score-importing/score-import-error";

/**
 * For us to save the incoming parserArguments,
 * we want to pretty it up a bit into something
 * actually legible for debugging reasons.
 *
 * As is typical for Tachi, we go for JSON. It's good.
 *
 * @note - Some things in our parserArguments might contain buffers.
 * Buffers are - by definition - stringified using `.toJSON`, which causes them to become
 * { type: "Buffer", data: [array_of_integers] }. This is frustrating to read, especially
 * while debugging, as now we need a viewer to understand the file that was provided.
 *
 * However, we have a viewer for this data anyway, so people are just going to have to
 * live with that inconvenience. It's not worth the hassle of - say - trying to turn
 * that buffer into UTF-8 when in the future we might accept binary-esque files as imports,
 * like SQLite dbs, or something.
 */
function SerialiseJobData(jobData: ScoreImportJobData<ImportTypes>): string {
	return JSON.stringify(jobData.parserArguments);
}

/**
 * Start tracking a score import by marking it as tracked in the database.
 *
 * @note - Awaiting this function is notable, as it will only await until the data is
 * inserted in the database. The part where it uploads the content to S3 is not actually
 * awaited when you await this function, it happens in the background.
 */
export async function StartTrackingImport(jobData: ScoreImportJobData<ImportTypes>) {
	await DB.insertInto("import_tracker")
		.values({
			import_id: jobData.importID,
			user_id: jobData.userID,
			import_type: jobData.importType,
			user_intent: jobData.userIntent,
			time_started: new Date().toISOString(),
			error: null,
		})
		.onConflict((oc) =>
			oc.column("import_id").doUpdateSet({
				user_id: jobData.userID,
				import_type: jobData.importType,
				user_intent: jobData.userIntent,
				time_started: new Date().toISOString(),
				error: null,
			}),
		)
		.execute();

	// store the input for this import on the CDN. The CDN is likely the right place
	// to store large amounts of write-only data, so lets do that.
	CDNStoreOrOverwrite(GetScoreImportInputURL(jobData.importID), SerialiseJobData(jobData)).catch(
		(err) => {
			log.error(
				// $response is a circular struct and we really don't like logging
				// cicular structs. gf.
				{ reason: { ...err.$error, $response: undefined } },
				`Failed to save score-import-input for import '${
					jobData.importID
				}' at path '${GetScoreImportInputURL(jobData.importID)}'.`,
			);
		},
	);
}

export async function MarkImportAsFailed(importID: string, error: Error | ScoreImportFatalError) {
	await DB.updateTable("import_tracker")
		.set({
			error: JSON.stringify({
				statusCode: "statusCode" in error ? error.statusCode : undefined,
				message: error.message,
			}),
		})
		.where("import_id", "=", importID)
		.execute();
}

/**
 * Successful imports don't need to be tracked. Only failed imports are kept around
 * in the tracker.
 */
export async function EndTrackingImport(importID: string) {
	await DB.deleteFrom("import_tracker").where("import_id", "=", importID).execute();
}
