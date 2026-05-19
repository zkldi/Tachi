import { ACTION_DeleteImport } from "#actions/delete-import";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import {
	GetImportTrackerByImportId,
	ListFailedImportTrackers,
	ListRecentImportDocuments,
	LoadImportDocumentById,
} from "#lib/db-formats/import-document";
import { LoadSessionDocumentById } from "#lib/db-formats/session";
import { GetImportScores } from "#lib/imports/imports";
import {
	JOB_STATUS_DONE,
	JOB_STATUS_FAILED,
	JOB_STATUS_QUEUED,
	JOB_STATUS_RUNNING,
} from "#lib/jobs/job-queue/constants";
import { log } from "#lib/log/log";
import { withImport } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import DB from "#services/pg/db";
import { GetRelevantSongsAndCharts } from "#utils/db";
import { GetUsersWithIDs, GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";

import { API_V1_ROUTER } from "../router";

// ─── Admin-facing import list ─────────────────────────────────────────────────

/**
 * Query imports. Returns the 500 most recently-finished imports.
 *
 * @param importType - Optionally, limit the returns to only this import type.
 * @param userIntent - Optionally, limit returns to only those with or without userIntent.
 *
 * @name GET /api/v1/imports
 */
API_V1_ROUTER.add("GET /imports", async ({ input }) => {
	const userIntent = input.userIntent === undefined ? undefined : input.userIntent === "true";

	const imports = await ListRecentImportDocuments({
		importType: input.importType as never,
		limit: 500,
		userIntent,
	});

	const users = await GetUsersWithIDs(imports.map((e) => e.userID));

	return success(`Found ${imports.length} imports.`, { imports, users });
});

/**
 * Query *failed* imports. Returns the 500 most recently-finished imports.
 *
 * This is done by checking import-trackers for imports that ended with a thrown
 * error. An import is considered 'failed' if ScoreImportFatalError is thrown at any
 * point during the process, or if any unknown error is thrown.
 *
 * @param importType - Optionally, limit the returns to only this import type.
 * @param userIntent - Optionally, limit returns to only those with or without userIntent.
 *
 * @name GET /api/v1/imports/failed
 */
API_V1_ROUTER.add("GET /imports/failed", async ({ input }) => {
	const userIntent = input.userIntent === undefined ? undefined : input.userIntent === "true";

	const trackers = await ListFailedImportTrackers({
		importType: input.importType as never,
		limit: 500,
		userIntent,
	});

	const users = await GetUsersWithIDs(trackers.map((e) => e.userID));

	return success(`Found ${trackers.length} failed imports.`, { failedImports: trackers, users });
});

/**
 * Retrieve an import with this ID.
 *
 * @name GET /api/v1/imports/:importID
 */
API_V1_ROUTER.add("GET /imports/:importID", withImport, async ({ ctx }) => {
	const { importDoc } = ctx;

	const scores = await GetImportScores(importDoc);
	const { songs, charts } = await GetRelevantSongsAndCharts(scores);

	const sessions = (
		await Promise.all(
			importDoc.createdSessions.map((e) => LoadSessionDocumentById(e.sessionID)),
		)
	).filter((s): s is NonNullable<typeof s> => s !== undefined);

	const user = await GetUserWithID(importDoc.userID);

	if (!user) {
		log.error(`User ${importDoc.userID} doesn't exist, yet has an import?`);
		throw new ExpectedErr(500, "An internal server error has occurred.");
	}

	return success("Returned info about this import.", {
		charts,
		import: importDoc,
		scores,
		sessions,
		songs,
		user,
	});
});

/**
 * Delete this import and revert it from having ever happened. This un-imports all
 * of the scores that were imported.
 *
 * Must be a request from the owner of this import.
 *
 * Counterintuitively, this endpoint requires the "delete_score" permission. This is
 * because reverting an import is actually just deleting all of its scores.
 *
 * @name POST /api/v1/imports/:importID/revert
 */
API_V1_ROUTER.add("POST /imports/:importID/revert", withImport, async ({ params, req }) => {
	const auth = req[SYMBOL_TACHI_API_AUTH];

	if (auth.userID === null) {
		throw new ExpectedErr(401, "Authentication is required.");
	}

	const user = await GetUserWithID(auth.userID);

	if (!user) {
		throw new ExpectedErr(401, "Authentication is required.");
	}

	await ACTION_DeleteImport(
		{ acct: { id: user.id, username: user.username }, ip: req.ip },
		{ id: params.importID },
	);

	return success("Reverted import.", {});
});

// ─── Import poll-status ───────────────────────────────────────────────────────

async function findJobQueueForImport(importID: string) {
	return DB.selectFrom("job_queue")
		.selectAll()
		.where("job_queue.scope", "=", `import:${importID}`)
		.orderBy("job_queue.created_at", "desc")
		.executeTakeFirst();
}

/**
 * Poll the status of a queued/in-progress import.
 *
 * Completion is determined by the `import.status` column, which starts as
 * `in_progress` when the stub row is created and is set to `completed`
 * atomically inside {@link finalizeImportToPostgres}. This avoids the
 * previous bug where a stub row was enough to report "completed" while
 * scores were still being inserted.
 *
 * When no `import` row exists yet (parsing phase) or it was cleaned up on
 * failure, we fall back to `job_queue` and `import_tracker` state.
 *
 * @name GET /api/v1/imports/:importID/poll-status
 */
API_V1_ROUTER.add("GET /imports/:importID/poll-status", async ({ params }) => {
	const importRow = await DB.selectFrom("import")
		.select(["import.id", "import.status"])
		.where("import.id", "=", params.importID)
		.executeTakeFirst();

	if (importRow) {
		if (importRow.status === "completed") {
			const importDoc = await LoadImportDocumentById(params.importID);

			if (importDoc) {
				return success("Import was completed!", {
					import: importDoc,
					importStatus: "completed",
				});
			}
		}

		return success("Import is ongoing.", {
			importStatus: "ongoing",
			progress: { description: "Importing scores." },
		});
	}

	// No import row yet — the run is still in the parsing phase, or the row
	// was deleted on failure. Use job_queue / import_tracker as fallbacks.

	const job = await findJobQueueForImport(params.importID);

	if (!job) {
		const tracker = await GetImportTrackerByImportId(params.importID);

		if (!tracker) {
			throw new ExpectedErr(404, "There is no ongoing import here.");
		}

		switch (tracker.type) {
			case "ONGOING":
				return success("Import is ongoing.", {
					importStatus: "ongoing",
					progress: { description: "Importing scores." },
				});

			case "FAILED":
				throw new ExpectedErr(tracker.error.statusCode ?? 500, tracker.error.message);

			default:
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				throw new Error(`Unknown tracker type ${(tracker as any).type}`);
		}
	}

	if (job.status === JOB_STATUS_FAILED) {
		log.error({ job }, "Postgres job_queue row in failed state.");
		throw new ExpectedErr(500, "An internal service error has occurred with this import.");
	}

	if (job.status === JOB_STATUS_QUEUED || job.status === JOB_STATUS_RUNNING) {
		return success("Import is ongoing.", {
			importStatus: "ongoing",
			progress: { description: "Importing scores." },
		});
	}

	if (job.status === JOB_STATUS_DONE) {
		const tracker = await GetImportTrackerByImportId(params.importID);

		if (tracker?.type === "FAILED") {
			throw new ExpectedErr(tracker.error.statusCode ?? 500, tracker.error.message);
		}

		return success("Import is ongoing.", {
			importStatus: "ongoing",
			progress: { description: "Importing scores." },
		});
	}

	throw new ExpectedErr(500, "Unrecognised job queue state.");
});
