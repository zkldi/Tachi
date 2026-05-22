import type { ImportDocument } from "tachi-common";

import { LoadScoreDocumentsForImport } from "#lib/db-formats/score";
import { log } from "#lib/log/log";
import {
	CheckAndSetOngoingImportLock,
	UnsetOngoingImportLock,
} from "#lib/score-import/framework/import-locks/lock";
import { DeleteMultipleScores } from "#lib/score-mutation/delete-scores";
import DB from "#services/pg/db";

interface OngoingImportError {
	tag: "ONGOING_IMPORT";
}

/**
 * Given an ImportDocument, undo it. This will remove all of the scores inside the import.
 *
 * It will *not* undo things like classes that were set, but it will invoke a profile recalculation.
 *
 * If this results in sessions being deleted, it will delete them.
 */
export async function RevertImport(importDoc: ImportDocument): Promise<OngoingImportError | null> {
	log.info({ importDoc }, `Received revert-import request for import '${importDoc.importID}'`);

	// Acquire the lock before loading scores so the snapshot is taken while the lock is held,
	// preventing a race between a concurrent delete and the PB/session recalculation that follows.
	const alreadyLocked = await CheckAndSetOngoingImportLock(importDoc.userID);

	if (alreadyLocked) {
		log.info(`User ${importDoc.userID} tried to revert an import while they had one ongoing.`);

		return {
			tag: "ONGOING_IMPORT",
		};
	}

	const scores = await GetImportScores(importDoc);

	try {
		await DeleteMultipleScores(scores);

		log.info(
			{ importDoc },
			`Deleted ${scores.length} scores as part of reverting import '${importDoc.importID}'.`,
		);

		const { numDeletedRows: orphansDeleted } = await DB.deleteFrom("orphan_score")
			.where("orphan_score.import_id", "=", importDoc.importID)
			.executeTakeFirstOrThrow();

		log.info(
			{ importDoc },
			`Deleted ${orphansDeleted} orphan scores as part of reverting import '${importDoc.importID}'.`,
		);

		try {
			await DB.deleteFrom("import").where("id", "=", importDoc.importID).execute();

			log.info(`Reverted and deleted import '${importDoc.importID}'.`);
		} catch (err) {
			log.error(
				{ importDoc, err },
				`Deleted scores that were part of import, but failed to remove the actual import? There is a stale import with ID '${importDoc.importID}', which must be removed manually.`,
			);
		}
	} finally {
		await UnsetOngoingImportLock(importDoc.userID);
	}

	return null;
}

/**
 * Loads all scores that belong to this import (Postgres `score.import_id`).
 */
export function GetImportScores(importDoc: ImportDocument) {
	return LoadScoreDocumentsForImport(importDoc.importID);
}
