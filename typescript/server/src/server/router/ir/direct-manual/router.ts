import type { ScoreImportJobData } from "#lib/score-import/worker/types";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { ExpressWrappedScoreImportMain } from "#lib/score-import/framework/express-wrapper";
import { EnqueueScoreImportJob } from "#lib/score-import/worker/enqueue-pg";
import { ServerConfig } from "#lib/setup/config";
import { RequirePermissions } from "#server/middleware/auth";
import { ScoreImportRateLimiter } from "#server/middleware/rate-limiter";
import { Random20Hex } from "#utils/misc";
import { Router } from "express";

const router: Router = Router({ mergeParams: true });

/**
 * Imports scores in ir/direct-manual form.
 * @name POST /ir/direct-manual/import
 */
router.post(
	"/import",
	RequirePermissions("submit_score"),
	ScoreImportRateLimiter,
	async (req, res) => {
		const userIntent = req.header("X-User-Intent")?.toLowerCase() === "true";
		const inferTimestamp = req.header("X-Infer-Score-TimeAchieved")?.toLowerCase() === "true";

		if (ServerConfig.INLINE_SCORE_IMPORT) {
			// Test-only inline path: run synchronously so tests get a real response body.
			const importResponse = await ExpressWrappedScoreImportMain<"ir/direct-manual">(
				req[SYMBOL_TACHI_API_AUTH].userID!,
				userIntent,
				"ir/direct-manual",
				[req.safeBody, inferTimestamp],
			);

			return res.status(importResponse.statusCode).json(importResponse.body);
		}

		const importID = Random20Hex();

		const job: ScoreImportJobData<"ir/direct-manual"> = {
			importID,
			userID: req[SYMBOL_TACHI_API_AUTH].userID!,
			userIntent,
			importType: "ir/direct-manual",
			parserArguments: [req.safeBody, inferTimestamp],
		};

		void EnqueueScoreImportJob(job);

		return res.status(202).json({
			success: true,
			description:
				"Import loaded into queue. You can poll the provided URL for information on when its complete.",
			body: {
				url: `${ServerConfig.OUR_URL}/api/v1/imports/${importID}/poll-status`,
				importID,
			},
		});
	},
);

export default router;
