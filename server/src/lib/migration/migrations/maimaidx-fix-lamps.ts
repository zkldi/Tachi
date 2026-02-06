import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { ProcessPBs } from "lib/score-import/framework/pb/process-pbs";
import UpdateScore from "lib/score-mutation/update-score";
import { RecalcAllScores } from "utils/calculations/recalc-scores";
import type { integer, ProvidedMetrics, ScoreDocument } from "tachi-common";
import type { Migration } from "utils/types";

const logger = CreateLogCtx(__filename);

const migration: Migration = {
	id: "maimaidx-fix-lamps",
	up: async () => {
		const affectedUserCharts: Map<integer, Set<string>> = new Map();
		const affectedCharts: Set<string> = new Set();

		// @ts-expect-error query assures we're getting maimaidx:Single scores
		const invalidScores: Array<ScoreDocument<"maimaidx:Single">> = await db.scores.find({
			game: "maimaidx",
			playtype: "Single",
			"scoreData.lamp": "FAILED",
			"scoreData.percent": { $gte: 80 },
		});

		invalidScores.push(
			// @ts-expect-error query assures we're getting maimaidx:Single scores
			...(await db.scores.find({
				game: "maimaidx",
				playtype: "Single",
				"scoreData.lamp": "CLEAR",
				"scoreData.percent": { $lt: 80 },
			}))
		);

		for (const score of invalidScores) {
			// @ts-expect-error just in case
			delete score._id;

			if (affectedUserCharts.has(score.userID)) {
				affectedUserCharts.get(score.userID)!.add(score.chartID);
			} else {
				affectedUserCharts.set(score.userID, new Set([score.chartID]));
			}

			affectedCharts.add(score.chartID);

			let lamp: ProvidedMetrics["maimaidx:Single"]["lamp"];

			if (score.scoreData.percent === 101) {
				lamp = "ALL PERFECT+";
			} else if (
				score.scoreData.percent >= 100.5 &&
				score.scoreData.judgements.great === 0 &&
				score.scoreData.judgements.good === 0 &&
				score.scoreData.judgements.miss === 0
			) {
				lamp = "ALL PERFECT";
			} else if (
				score.scoreData.judgements.good === 0 &&
				score.scoreData.judgements.miss === 0
			) {
				lamp = "FULL COMBO+";
			} else if (score.scoreData.judgements.miss === 0) {
				lamp = "FULL COMBO";
			} else if (score.scoreData.percent >= 80) {
				lamp = "CLEAR";
			} else {
				lamp = "FAILED";
			}

			await UpdateScore(
				score,
				{
					...score,
					scoreData: {
						...score.scoreData,
						lamp,
					},
				},
				/* updateOldChart=*/ false,
				/* skipUpdatingPBs=*/ true
			);
		}

		for (const [userID, chartIDs] of affectedUserCharts.entries()) {
			logger.info(`PBing #${userID}'s scores.`);

			await ProcessPBs("maimaidx", "Single", userID, chartIDs, logger);
		}

		// maimai DX CiRCLE rating recalc
		await RecalcAllScores({
			game: "maimaidx",
			"scoreData.lamp": {
				$in: ["ALL PERFECT", "ALL PERFECT+"],
			},
		});
	},
	down: () => {
		throw new Error(`Unable to revert transaction.`);
	},
};

export default migration;
