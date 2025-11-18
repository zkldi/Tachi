// Attempt to deoprhan lost scores.

import CreateLogCtx from "lib/logger/logger";
import { DeorphanScores } from "lib/score-import/framework/orphans/orphans";
import { WrapScriptPromise } from "utils/misc";

const logger = CreateLogCtx(__dirname);

export async function DeorphanScoresMain() {
	const { success, failed, removed } = await DeorphanScores({}, logger);

	logger.info(`Finished attempting deorphaning.`);

	logger.info(`Success: ${success} | Failed ${failed} | Removed ${removed}.`);
}

if (require.main === module) {
	WrapScriptPromise(DeorphanScoresMain(), logger);
}
