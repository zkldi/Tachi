import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { ExpressWrappedScoreImportMain } from "#lib/score-import/framework/express-wrapper";
import { RequirePermissions } from "#server/middleware/auth";
import { Router } from "express";

const router: Router = Router({ mergeParams: true });

router.use(RequirePermissions("submit_score"));

/**
 * Submits a single score document from Barbatos clients.
 * @name POST /ir/barbatos/score/submit
 */
router.post("/score/submit", async (req, res) => {
	const responseData = await ExpressWrappedScoreImportMain(
		req[SYMBOL_TACHI_API_AUTH].userID!,
		false,
		"ir/barbatos",
		[req.safeBody],
	);

	return res.status(responseData.statusCode).json(responseData.body);
});

export default router;
