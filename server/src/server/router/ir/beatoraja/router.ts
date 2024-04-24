import { ValidateIRClientVersion } from "./auth";
import chartsRouter from "./charts/_chartSHA256/router";
import { Router } from "express";
import db from "external/mongo/db";
import { SYMBOL_TACHI_API_AUTH } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { ExpressWrappedScoreImportMain } from "lib/score-import/framework/express-wrapper";
import { ServerConfig } from "lib/setup/config";
import { p } from "prudence";
import { RequireNotGuest } from "server/middleware/auth";
import prValidate from "server/middleware/prudence-validate";
import { UpdateClassIfGreater } from "utils/class";
import { IsRecord, NotNullish } from "utils/misc";
import type {
	BeatorajaChart,
	BeatorajaScore,
} from "lib/score-import/import-types/ir/beatoraja/types";
import type { integer } from "tachi-common";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

router.use(ValidateIRClientVersion);

/**
 * Submits a beatoraja score to Tachi.
 *
 * @name POST /ir/beatoraja/submit-score
 */
router.post("/submit-score", RequireNotGuest, async (req, res) => {
	const userID = NotNullish(req[SYMBOL_TACHI_API_AUTH].userID);

	const importRes = await ExpressWrappedScoreImportMain(userID, false, "ir/beatoraja", [
		req.safeBody,
		userID,
	]);

	if (!importRes.body.success) {
		return res.status(400).json(importRes.body);
	} else if (importRes.body.body.errors[0]) {
		const type = importRes.body.body.errors[0].type;
		const errMsg = importRes.body.body.errors[0].message;

		// If the error type is SongOrChartNotFound, then we **know** that
		// the chart and score values were atleast typed correctly
		// and can afford to make this assertion.
		if (type === "SongOrChartNotFound") {
			const { chart } = req.safeBody as { chart: BeatorajaChart };

			const orphanInfo: { userIDs: Array<integer> } | null = await db[
				"orphan-chart-queue"
			].findOne(
				{
					"chartDoc.data.hashSHA256": chart.sha256,
				},
				{ projection: { userIDs: 1 } }
			);

			if (!orphanInfo) {
				logger.warn(
					`Chart '${chart.sha256}' got SongOrChartNotFound, but was not orphaned?`,
					{
						body: req.safeBody as unknown,
					}
				);

				return res.status(400).json({
					success: false,
					description: "This chart is not supported.",
				});
			}

			return res.status(202).json({
				success: true,
				description: `Chart and score have been orphaned. This chart will be un-orphaned when ${ServerConfig.BEATORAJA_QUEUE_SIZE} players have played the chart (Currently: ${orphanInfo.userIDs.length}).`,
				body: {},
			});
		} else if (type === "InternalError") {
			return res.status(500).json({
				success: false,
				description: `[${type}] - ${errMsg}`,
			});
		}

		// since we're only ever importing one score, we can guarantee
		// that this means the score we tried to import was skipped.

		return res.status(400).json({
			success: false,
			description: `[${type}] - ${errMsg}`,
		});
	} else if (importRes.body.body.scoreIDs.length === 0) {
		return res.status(400).json({
			success: false,
			description: `No scores were imported.`,
		});
	}

	const scoreDoc = await db.scores.findOne({
		scoreID: importRes.body.body.scoreIDs[0],
	});

	if (!scoreDoc) {
		logger.severe(
			`ScoreDocument ${importRes.body.body.scoreIDs[0]} was claimed to be inserted, but wasn't.`
		);
		return res.status(500).json({
			success: false,
			description: "Internal Service Error.",
		});
	}

	let song;
	let chart;

	if (importRes.body.body.game === "bms") {
		chart = await db.charts.bms.findOne({
			chartID: scoreDoc.chartID,
		});

		if (!chart) {
			logger.error(
				`Expected to a find a bms chart with chartID ${scoreDoc.chartID}, but found none?`
			);

			return res.status(500).json({
				success: false,
				description: `Internal Service Error.`,
			});
		}

		song = await db.songs.bms.findOne({
			id: chart.songID,
		});
	} else {
		chart = await db.charts.pms.findOne({
			chartID: scoreDoc.chartID,
		});

		if (!chart) {
			logger.error(
				`Expected to a find a pms chart with chartID ${scoreDoc.chartID}, but found none?`
			);

			return res.status(500).json({
				success: false,
				description: `Internal Service Error.`,
			});
		}

		song = await db.songs.pms.findOne({
			id: chart.songID,
		});
	}

	return res.status(importRes.statusCode).json({
		success: true,
		description: "Imported score.",
		body: {
			score: scoreDoc,
			song,
			chart,
			import: importRes.body.body,
		},
	});
});

/**
 * Submits a course result to Tachi. This only accepts a limited set of
 * courses - all of which are dans.
 *
 * @name POST /ir/beatoraja/submit-course
 */
router.post(
	"/submit-course",
	prValidate(
		{
			course: {
				charts: (self) => {
					return (
						(Array.isArray(self) &&
							self.length === 4 &&
							self.every(
								(maybeChart: unknown) =>
									IsRecord(maybeChart) && typeof maybeChart.md5 === "string"
							)) ||
						"Expected an array of 4 objects with MD5 properties."
					);
				},
				constraint: ["string"],
			},
			score: {
				// For some reason, a course can have any of these lamps.
				// Since I'm too lazy to delve into the code to find which of these are actually used
				// I'm going to assume any of them can come in, and handle them later.
				clear: p.isIn(
					"NoPlay",
					"Failed",
					"AssistEasy",
					"LightAssistEasy",
					"Easy",
					"Normal",
					"Hard",
					"ExHard",
					"FullCombo",
					"Perfect",
					"Max"
				),
				option: p.isInteger,
				lntype: p.isIn(0, 1, 2),
			},
		},
		{},
		{ allowExcessKeys: true }
	),
	RequireNotGuest,
	async (req, res) => {
		const body = req.safeBody as {
			course: {
				charts: Array<{ md5: string }>;
				constraint: Array<string>;
			};
			score: {
				clear: BeatorajaScore["clear"];
				option: integer;
				lntype: 0 | 1 | 2;
			};
		};

		const charts = body.course.charts;
		const clear = body.score.clear;

		if (
			clear === "Failed" ||
			clear === "NoPlay" ||
			clear === "Easy" ||
			clear === "LightAssistEasy" ||
			clear === "AssistEasy"
		) {
			return res.status(200).json({
				success: true,
				description: "Class not updated, as you didn't clear this course.",
			});
		}

		if (body.score.lntype !== 0) {
			return res.status(400).json({
				success: false,
				description: "LN mode is the only supported mode for dans.",
			});
		}

		if (body.course.constraint.includes("CN")) {
			return res.status(400).json({
				success: false,
				description: `CN mode is not allowed in dans.`,
			});
		}

		if (body.course.constraint.includes("HCN")) {
			return res.status(400).json({
				success: false,
				description: `HCN mode is not allowed in dans.`,
			});
		}

		if (body.course.constraint.some((f) => f.startsWith("GAUGE_") && f !== "GAUGE_LR2")) {
			return res.status(400).json({
				success: false,
				description: `Dan GAUGE mode must be GAUGE_LR2.`,
			});
		}

		if (body.score.option !== 0 && body.score.option !== 1) {
			return res.status(400).json({
				success: false,
				description: `RANDOM is not allowed in courses.`,
			});
		}

		// Combine the md5s into one string in their order.
		const combinedMD5s = charts.map((e) => e.md5).join("");

		const course = await db["bms-course-lookup"].findOne({
			md5sums: combinedMD5s,
		});

		if (!course) {
			return res.status(404).json({
				success: false,
				description: `Unsupported course.`,
			});
		}

		const userID = NotNullish(req[SYMBOL_TACHI_API_AUTH].userID);

		const result = await UpdateClassIfGreater(
			userID,
			"bms",
			course.playtype,
			course.set,
			course.value
		);

		if (result === false) {
			return res.status(200).json({
				success: true,
				description: "Class not updated.",
				body: {
					set: course.set,
					value: course.value,
				},
			});
		}

		return res.status(200).json({
			success: true,
			description: "Successfully updated class.",
			body: {
				set: course.set,
				value: course.value,
			},
		});
	}
);

router.use("/charts/:chartSHA256", chartsRouter);

export default router;
