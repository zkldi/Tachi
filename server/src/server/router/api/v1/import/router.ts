import { Router } from "express";
import { SIXTEEN_MEGABTYES } from "lib/constants/filesize";
import { SYMBOL_TACHI_API_AUTH } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { ExpressWrappedScoreImportMain } from "lib/score-import/framework/express-wrapper";
import { DeorphanScores } from "lib/score-import/framework/orphans/orphans";
import { MakeScoreImport } from "lib/score-import/framework/score-import";
import { ServerConfig, TachiConfig } from "lib/setup/config";
import { p } from "prudence";
import { RequirePermissions } from "server/middleware/auth";
import { CreateMulterSingleUploadMiddleware } from "server/middleware/multer-upload";
import prValidate from "server/middleware/prudence-validate";
import { ScoreImportRateLimiter } from "server/middleware/rate-limiter";
import { Random20Hex } from "utils/misc";
import { FormatUserDoc, GetUserWithIDGuaranteed } from "utils/user";
import type { ScoreImportJobData } from "lib/score-import/worker/types";
import type { APIImportTypes, FileUploadImportTypes } from "tachi-common";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

const ParseMultipartScoredata = CreateMulterSingleUploadMiddleware(
	"scoreData",
	SIXTEEN_MEGABTYES,
	logger
);

const fileImportTypes = TachiConfig.IMPORT_TYPES.filter((e) => e.startsWith("file/"));
const apiImportTypes = TachiConfig.IMPORT_TYPES.filter((e) => e.startsWith("api/"));

/**
 * Import scores from a file. Expects the post request to be multipart, and to provide a scoreData file.
 *
 * @param importType - The import type for this file.
 * @param file - The actual file. Should be passed as multipart.
 *
 * @name POST /api/v1/import/file
 */
router.post(
	"/file",
	RequirePermissions("submit_score"),
	ScoreImportRateLimiter,
	ParseMultipartScoredata,
	prValidate(
		{
			importType: p.isIn(fileImportTypes),
		},
		{},
		{ allowExcessKeys: true }
	),
	async (req, res) => {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				description: `No file provided.`,
			});
		}

		const importType = req.safeBody.importType as FileUploadImportTypes;

		const userIntent = req.header("X-User-Intent")?.toLowerCase() === "true";

		if (ServerConfig.USE_EXTERNAL_SCORE_IMPORT_WORKER) {
			const importID = Random20Hex();

			const job: ScoreImportJobData<FileUploadImportTypes> = {
				importID,
				userID: req[SYMBOL_TACHI_API_AUTH].userID!,
				userIntent,
				importType,
				parserArguments: [req.file, req.safeBody],
			};

			// Fire the score import, but make no guarantees about its state.
			void MakeScoreImport<FileUploadImportTypes>(job);

			return res.status(202).json({
				success: true,
				description:
					"Import loaded into queue. You can poll the provided URL for information on when its complete.",
				body: {
					url: `${ServerConfig.OUR_URL}/api/v1/imports/${importID}/poll-status`,
					importID,
				},
			});
		}

		// Fire the score import and wait for it to finish!
		const importResponse = await ExpressWrappedScoreImportMain<FileUploadImportTypes>(
			req[SYMBOL_TACHI_API_AUTH].userID!,
			userIntent,
			importType,
			[req.file, req.safeBody]
		);

		return res.status(importResponse.statusCode).json(importResponse.body);
	}
);

/**
 * Import scores from another API. This typically will perform a full sync.
 * @name POST /api/v1/import/from-api
 */
router.post(
	"/from-api",
	RequirePermissions("submit_score"),
	prValidate(
		{
			importType: p.isIn(apiImportTypes),
		},
		{},
		{ allowExcessKeys: true }
	),
	async (req, res) => {
		const importType = req.safeBody.importType as APIImportTypes;

		const importID = Random20Hex();

		const userID = req[SYMBOL_TACHI_API_AUTH].userID!;

		const userIntent = req.header("X-User-Intent")?.toLowerCase() === "true";

		if (ServerConfig.USE_EXTERNAL_SCORE_IMPORT_WORKER) {
			const job: ScoreImportJobData<APIImportTypes> = {
				importID,
				userID,
				userIntent,
				importType,
				parserArguments: [userID],
			};

			// Fire the score import, but make no guarantees about its state.
			void MakeScoreImport<APIImportTypes>(job);

			return res.status(202).json({
				success: true,
				description:
					"Import loaded into queue. You can poll the provided URL for information on when its complete.",
				body: {
					url: `${ServerConfig.OUR_URL}/api/v1/imports/${importID}/poll-status`,
					importID,
				},
			});
		}

		// Fire the score import and wait for it to finish!
		const importResponse = await ExpressWrappedScoreImportMain<APIImportTypes>(
			userID,
			userIntent,
			importType,
			[userID]
		);

		return res.status(importResponse.statusCode).json(importResponse.body);
	}
);

/**
 * Force Tachi to reprocess your orphaned scores. This is automatically done
 * daily, but this endpoint allows users to speed that up.
 *
 * @name POST /api/v1/import/orphans
 */
router.post("/orphans", RequirePermissions("submit_score"), async (req, res) => {
	const userDoc = await GetUserWithIDGuaranteed(req[SYMBOL_TACHI_API_AUTH].userID!);

	logger.info(`User ${FormatUserDoc(userDoc)} forced an orphan sync.`);

	const { processed, removed, failed, success } = await DeorphanScores(
		{ userID: userDoc.id },
		logger
	);

	logger.info(`Finished attempting deorphaning.`);

	logger.info(`Success: ${success} | Failed ${failed} | Removed ${removed}.`);

	return res.status(200).json({
		success: true,
		description: `Reprocessed ${processed} orphan scores.`,
		body: {
			processed,
			failed,
			success,
			removed,
		},
	});
});

export default router;
