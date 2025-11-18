// Attempt to deoprhan lost scores.

import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { ReprocessOrphan } from "lib/score-import/framework/orphans/orphans";
import { WrapScriptPromise } from "utils/misc";

const logger = CreateLogCtx(__dirname);

export async function DeoprhanScores() {
	const orphans = await db["orphan-scores"].find({});

	// ScoreIDs are essentially userID dependent, so this is fine.
	const blacklist = (await db["score-blacklist"].find({})).map((e) => e.scoreID);

	logger.info(`Found ${orphans.length} orphans.`);

	let failed = 0;
	let success = 0;
	let removed = 0;

	for (const or of orphans) {
		// We have to await like this to avoid mid-air race conditions,
		// where two orphans attempt to deorphan to the same scoreID
		// at the same time.
		// See #511.

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
		}
	}

	logger.info(`Finished attempting deorphaning.`);

	logger.info(`Success: ${success} | Failed ${failed} | Removed ${removed}.`);
}

if (require.main === module) {
	WrapScriptPromise(DeoprhanScores(), logger);
}
