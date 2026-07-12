import { MODEL_SDVX3_KONASTE } from "#lib/constants/ea3id";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { SELECT_KSHOOK_SV6C_SETTINGS } from "#lib/db-formats/kshook-sv6c-settings";
import { log } from "#lib/log/log";
import { ExpressWrappedScoreImportMain } from "#lib/score-import/framework/express-wrapper";
import DB from "#services/pg/db";
import { ParseEA3SoftID } from "#utils/ea3id";
import { IsNullishOrEmptyStr } from "#utils/misc";
import { type RequestHandler, Router } from "express";

const router: Router = Router({ mergeParams: true });

const ValidateHeaders: RequestHandler = (req, res, next) => {
	const agent = req.header("User-Agent");

	if (IsNullishOrEmptyStr(agent)) {
		log.debug(
			`Rejected KsHook client with no agent from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid User-Agent.`,
		});
	}

	if (!agent.startsWith("kshook/")) {
		log.info(
			`Rejected KsHook client with invalid agent ${agent} from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid User-Agent ${agent} - expected KsHook client.`,
		});
	}

	// We don't currently need to check the version or anything i don't think.
	// We should be good.

	const softID = req.header("X-Software-Model");

	if (IsNullishOrEmptyStr(softID)) {
		log.debug(
			`received request without X-Software-Model from ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	try {
		const modelInfo = ParseEA3SoftID(softID);

		if (modelInfo.model !== MODEL_SDVX3_KONASTE) {
			log.info(
				`received unexpected softID ${softID}. Expected ${MODEL_SDVX3_KONASTE} as model.`,
			);
			return res.status(400).json({
				success: false,
				error: `Invalid softID ${softID}.`,
			});
		}
	} catch (err) {
		log.info({ err }, `Invalid softID from ${req[SYMBOL_TACHI_API_AUTH].userID}.`);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	next();
};

router.use(ValidateHeaders);

/**
 * Saves a SDVX Konaste score.
 *
 * @name POST /ir/kshook/sv6c/score/save
 */
router.post("/score/save", async (req, res) => {
	const responseData = await ExpressWrappedScoreImportMain(
		req[SYMBOL_TACHI_API_AUTH].userID!,
		false,
		"ir/kshook-sv6c",
		[req.safeBody],
	);

	if (!responseData.body.success) {
		// in-air rewrite description to error.
		// @ts-expect-error Hack!
		responseData.body.error = responseData.body.description;

		// @ts-expect-error Hack!
		delete responseData.body.description;
	}

	return res.status(responseData.statusCode).json(responseData.body);
});

/**
 * Imports statically from KsHook. Analogous to fervidex-static.
 *
 * @name POST /ir/kshook/sv6c/score/export
 */
router.post("/score/export", async (req, res) => {
	const userID = req[SYMBOL_TACHI_API_AUTH].userID!;

	const row = await DB.selectFrom("svc_kshook_sv6c_settings")
		.select(SELECT_KSHOOK_SV6C_SETTINGS)
		.where("user_id", "=", userID)
		.executeTakeFirst();

	if (!row?.force_static_import) {
		return res.status(200).json({
			success: true,
			description: "Static importing is disabled. Ignoring static import request.",
			body: {},
		});
	}

	await DB.insertInto("svc_kshook_sv6c_settings")
		.values({ user_id: userID, force_static_import: false })
		.onConflict((oc) => oc.column("user_id").doUpdateSet({ force_static_import: false }))
		.execute();

	const responseData = await ExpressWrappedScoreImportMain(
		userID,
		false,
		"ir/kshook-sv6c-static",
		[req.safeBody],
	);

	if (!responseData.body.success) {
		// in-air rewrite description to error.
		// @ts-expect-error Hack!
		responseData.body.error = responseData.body.description;

		// @ts-expect-error Hack!
		delete responseData.body.description;
	}

	return res.status(responseData.statusCode).json(responseData.body);
});

export default router;
