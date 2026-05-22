import type { FileUploadImportTypes } from "tachi-common";

import { SIXTEEN_MEGABTYES } from "#lib/constants/filesize";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { log } from "#lib/log/log";
import { withPermission } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import {
	deleteOrphanScoreForUser,
	DeorphanScores,
	getOrphanScoreDetailForUser,
	listOrphanScoresForUser,
} from "#lib/score-import/framework/orphans/orphans";
import { EnqueueScoreImportJob } from "#lib/score-import/worker/enqueue-pg";
import { ServerConfig, TachiConfig } from "#lib/setup/config";
import { RequirePermissions } from "#server/middleware/auth";
import { CreateMulterSingleUploadMiddleware } from "#server/middleware/multer-upload";
import prValidate from "#server/middleware/prudence-validate";
import { ScoreImportRateLimiter } from "#server/middleware/rate-limiter";
import { Random20Hex } from "#utils/misc";
import { FormatUserDoc, GetUserWithIDGuaranteed } from "#utils/user";
import { ExpectedErr } from "bliss";
import { p } from "prudence";

import { API_V1_ROUTER } from "../_singleton";

const ParseMultipartScoredata = CreateMulterSingleUploadMiddleware("scoreData", SIXTEEN_MEGABTYES);

const fileImportTypes = TachiConfig.IMPORT_TYPES.filter((e) => e.startsWith("file/"));

/**
 * Import scores from a file. Expects the post request to be multipart,
 * and to provide a scoreData file.
 *
 * @param importType - The import type for this file.
 * @param file - The actual file. Should be passed as multipart.
 *
 * @name POST /api/v1/import/file
 */
API_V1_ROUTER.rawAdd(
	"POST",
	"/import/file",
	RequirePermissions("submit_score"),
	ScoreImportRateLimiter,
	ParseMultipartScoredata,
	prValidate(
		{
			importType: p.isIn(fileImportTypes),
		},
		{},
		{ allowExcessKeys: true },
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

		const importID = Random20Hex();

		// Fire the score import, but make no guarantees about its state.
		void EnqueueScoreImportJob({
			importID,
			userID: req[SYMBOL_TACHI_API_AUTH].userID!,
			userIntent,
			importType,
			parserArguments: [req.file, req.safeBody],
		});

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

/**
 * Import scores from another API. This typically will perform a full sync.
 *
 * @name POST /api/v1/import/from-api
 */
API_V1_ROUTER.add("POST /import/from-api", async ({ input, req }) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const importType = input.importType as any;
	const importID = Random20Hex();
	const userID = req[SYMBOL_TACHI_API_AUTH].userID!;
	const userIntent = req.header("X-User-Intent")?.toLowerCase() === "true";

	void EnqueueScoreImportJob({
		importID,
		importType,
		parserArguments: [userID],
		userID,
		userIntent,
	});

	return {
		$status: 202,
		body: {
			importID,
			url: `${ServerConfig.OUR_URL}/api/v1/imports/${importID}/poll-status`,
		},
		description:
			"Import loaded into queue. You can poll the provided URL for information on when its complete.",
		success: true,
	};
});

/**
 * Force Tachi to reprocess your orphaned scores. This is automatically done
 * daily, but this endpoint allows users to speed that up.
 *
 * @name POST /api/v1/import/orphans
 */
API_V1_ROUTER.add("POST /import/orphans", withPermission("submit_score"), async ({ req }) => {
	const userDoc = await GetUserWithIDGuaranteed(req[SYMBOL_TACHI_API_AUTH].userID!);

	log.info(`User ${FormatUserDoc(userDoc)} forced an orphan sync.`);

	const {
		processed,
		removed,
		failed,
		success: orphanSuccess,
	} = await DeorphanScores({ userID: userDoc.id }, log);

	return success(`Reprocessed ${processed} orphan scores.`, {
		failed,
		processed,
		removed,
		success: orphanSuccess,
	});
});

/**
 * List orphaned scores for the current user (scores that could not be matched to a chart).
 *
 * @name GET /api/v1/import/orphans
 */
API_V1_ROUTER.add("GET /import/orphans", withPermission("submit_score"), async ({ input, req }) => {
	const userDoc = await GetUserWithIDGuaranteed(req[SYMBOL_TACHI_API_AUTH].userID!);

	const body = await listOrphanScoresForUser({
		userID: userDoc.id,
		limit: input.limit,
		afterRowID: input.after,
	});

	return success(`Returned ${body.orphans.length} orphan scores.`, body);
});

/**
 * Return one orphaned score row (including raw data/context) for the current user.
 *
 * @name GET /api/v1/import/orphans/:orphanID
 */
API_V1_ROUTER.add(
	"GET /import/orphans/:orphanID",
	withPermission("submit_score"),
	async ({ params, req }) => {
		const userDoc = await GetUserWithIDGuaranteed(req[SYMBOL_TACHI_API_AUTH].userID!);

		const detail = await getOrphanScoreDetailForUser(params.orphanID, userDoc.id);

		if (!detail) {
			throw new ExpectedErr(404, "No such orphan score for this user.");
		}

		return success("Returned orphan score.", detail);
	},
);

/**
 * Delete a single orphaned score row for the current user.
 *
 * @name DELETE /api/v1/import/orphans/:orphanID
 */
API_V1_ROUTER.add(
	"DELETE /import/orphans/:orphanID",
	withPermission("submit_score"),
	async ({ params, req }) => {
		const userDoc = await GetUserWithIDGuaranteed(req[SYMBOL_TACHI_API_AUTH].userID!);

		const deleted = await deleteOrphanScoreForUser(params.orphanID, userDoc.id);

		if (!deleted) {
			throw new ExpectedErr(404, "No such orphan score for this user.");
		}

		return success("Deleted orphan score.", {});
	},
);
