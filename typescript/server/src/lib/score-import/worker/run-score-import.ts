import type { ImportDocument, ImportTypes } from "tachi-common";

import { ACTION_ScoreImport } from "#actions/score-import";
import { LoadImportDocumentById } from "#lib/db-formats/import-document";
import {
	CheckAndSetOngoingImportLock,
	UnsetOngoingImportLock,
} from "#lib/score-import/framework/import-locks/lock";
import { GetUserWithID } from "#utils/user";
import { ExpectedErr } from "bliss";

import type { ScoreImportJobData } from "./types";

export type RunScoreImportResult =
	| { description: string; kind: "expected_err"; statusCode: number }
	| { importDoc: ImportDocument; kind: "done" }
	| { kind: "lock_held" };

/**
 * Canonical entry point for running a score import to completion.
 *
 * Acquires the per-user import lock before invoking {@link ACTION_ScoreImport}.
 * If the lock is already held by a concurrent import, returns `{ kind: "lock_held" }`
 * immediately without touching the action table (no BAD audit row).
 *
 * The lock is always released in a finally block, so callers do not need to
 * manage it themselves.
 */
export async function RunScoreImportOnce<I extends ImportTypes>(
	jobData: ScoreImportJobData<I>,
): Promise<RunScoreImportResult> {
	const held = await CheckAndSetOngoingImportLock(jobData.userID);

	if (held) {
		return { kind: "lock_held" };
	}

	const user = await GetUserWithID(jobData.userID);
	if (!user) {
		throw new Error(
			`RunScoreImportOnce: user ${jobData.userID} not found — cannot build action taker.`,
		);
	}

	const taker = { ip: null, acct: { id: user.id, username: user.username } };

	try {
		await ACTION_ScoreImport(taker, {
			importID: jobData.importID,
			importType: jobData.importType,
			userIntent: jobData.userIntent,
			"!parserArguments": jobData.parserArguments as Array<unknown>,
			skipStartTracking: true,
		});

		const importDoc = await LoadImportDocumentById(jobData.importID);

		if (!importDoc) {
			throw new Error(
				`RunScoreImportOnce: import ${jobData.importID} completed but the import document could not be loaded.`,
			);
		}

		return { kind: "done", importDoc };
	} catch (e) {
		if (ExpectedErr.is(e)) {
			return { kind: "expected_err", statusCode: e.code, description: e.reason };
		}

		throw e;
	} finally {
		await UnsetOngoingImportLock(jobData.userID);
	}
}
