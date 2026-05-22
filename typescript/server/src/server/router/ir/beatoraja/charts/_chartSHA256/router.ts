import type { BMSGames, integer, PBScoreDocument } from "tachi-common";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { LoadAllPbsForChartPgId } from "#lib/db-formats/pb";
import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { FindBeatorajaChartOnHashSHA256 } from "#utils/queries/charts";
import { REQ_AssignToReqTachiData, REQ_GetTachiData } from "#utils/req-tachi-data";
import { type RequestHandler, Router } from "express";

import { TachiScoreDataToBeatorajaFormat } from "./convert-scores";

const router: Router = Router({ mergeParams: true });

const GetChartDocument: RequestHandler = async (req, res, next) => {
	const chart = await FindBeatorajaChartOnHashSHA256(req.params.chartSHA256);

	// if we still haven't found it, we've got nothin.
	if (!chart) {
		return res.status(404).json({
			success: false,
			description: `Chart does not exist on IR yet.`,
		});
	}

	REQ_AssignToReqTachiData(req, { beatorajaChartDoc: chart });

	next();
};

router.use(GetChartDocument);

/**
 * Retrieves scores for the given chart.
 *
 * @name GET /ir/beatoraja/charts/:chartSHA256/scores
 */
router.get("/scores", async (req, res) => {
	const chart = REQ_GetTachiData(req, "beatorajaChartDoc");
	const requestingUserID = req[SYMBOL_TACHI_API_AUTH].userID;

	const scores = await LoadAllPbsForChartPgId(chart.chartID);

	const userIds = [...new Set(scores.map((e) => e.userID))];
	const userMap = new Map<integer, string>();

	if (userIds.length > 0) {
		const userRows = await DB.selectFrom("account")
			.select(["account.id", "account.username"])
			.where("account.id", "in", userIds)
			.execute();

		for (const u of userRows) {
			userMap.set(u.id, u.username);
		}
	}

	const beatorajaScores = [];

	for (const score of scores) {
		const username = userMap.get(score.userID);

		if (!username) {
			log.warn(
				`A PB on ${score.chartID} refers to user ${score.userID}, who apparantly doesn't exist? Skipping for beatoraja score returns, but this might be severe!`,
			);
			continue;
		}

		beatorajaScores.push(
			TachiScoreDataToBeatorajaFormat(
				score as PBScoreDocument<BMSGames>,
				chart.data.hashSHA256,
				score.userID === requestingUserID ? "" : username,
				chart.data.notecount,
				0,
			),
		);
	}

	return res.status(200).json({
		success: true,
		description: `Successfully returned ${beatorajaScores.length}`,
		body: beatorajaScores,
	});
});

export default router;
