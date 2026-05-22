import type {
	BeatorajaChart,
	BeatorajaScore,
} from "#lib/score-import/import-types/ir/beatoraja/types";

import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { GetChartById } from "#lib/db-formats/chart";
import {
	type PbDocumentJoinRow,
	SELECT_PB_DOCUMENT_WITH_LEADERBOARD,
	ToPbScoreDocument,
} from "#lib/db-formats/pb";
import { LoadScoreDocumentById } from "#lib/db-formats/score";
import { GetSongByID } from "#lib/db-formats/song";
import { log } from "#lib/log/log";
import { ExpressWrappedScoreImportMain } from "#lib/score-import/framework/express-wrapper";
import { ServerConfig } from "#lib/setup/config";
import { RequireNotGuest } from "#server/middleware/auth";
import prValidate from "#server/middleware/prudence-validate";
import DB from "#services/pg/db";
import { UpdateClassIfGreater } from "#utils/class";
import { DedupeArr, IsRecord, NotNullish } from "#utils/misc";
import { GetUsersWithIDs, ResolveUser } from "#utils/user";
import { Router } from "express";
import { sql } from "kysely";
import { p } from "prudence";
import {
	type BMSGames,
	type Classes,
	type GamesForGroup,
	GameToGameGroup,
	type integer,
	type PBScoreDocument,
	type UserDocument,
} from "tachi-common";

import { ValidateIRClientVersion } from "./auth";
import { TachiScoreDataToBeatorajaFormat } from "./charts/_chartSHA256/convert-scores";
import chartsRouter from "./charts/_chartSHA256/router";

const router: Router = Router({ mergeParams: true });

router.use(ValidateIRClientVersion);

const BEATORAJA_GAMES = ["bms-7k", "bms-14k", "pms-controller", "pms-keyboard"] as const;

interface BeatorajaPbExportRow extends PbDocumentJoinRow {
	chart_data: unknown;
}

function GetBeatorajaChartData(row: BeatorajaPbExportRow) {
	const chartData = row.chart_data as Record<string, unknown>;
	const sha256 = chartData.hashSHA256;
	const notecount = chartData.notecount;

	if (typeof sha256 !== "string" || typeof notecount !== "number") {
		log.warn(
			{ chartID: row.chart_id, chartData },
			`Skipping Beatoraja PB export row with invalid chart data.`,
		);
		return null;
	}

	return { notecount, sha256 };
}

async function GetBeatorajaRivalUsers(userID: integer): Promise<UserDocument[]> {
	const rivalRows = await DB.selectFrom("game_rival")
		.select("game_rival.rival")
		.where("game_rival.user_id", "=", userID)
		.where("game_rival.game", "in", BEATORAJA_GAMES)
		.execute();

	const rivalIDs = DedupeArr(rivalRows.map((r) => r.rival));

	return GetUsersWithIDs(rivalIDs);
}

async function GetPermittedBeatorajaUserIDs(userID: integer) {
	return new Set([userID, ...(await GetBeatorajaRivalUsers(userID)).map((r) => r.id)]);
}

async function LoadBeatorajaPbsForUser(userID: integer): Promise<BeatorajaPbExportRow[]> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select([...SELECT_PB_DOCUMENT_WITH_LEADERBOARD, "chart.data as chart_data"])
		.where("pb.user_id", "=", userID)
		.where("chart.game", "in", BEATORAJA_GAMES)
		.where("pb.lens", "is", null)
		.orderBy("pb.time_achieved", "desc")
		.execute();

	return rows as BeatorajaPbExportRow[];
}

async function FormatBeatorajaPbsForUser(user: UserDocument, requestedBy: integer) {
	const rows = await LoadBeatorajaPbsForUser(user.id);
	const scores = await Promise.all(
		rows.map(async (row) => {
			const chartData = GetBeatorajaChartData(row);

			if (!chartData) {
				return null;
			}

			const pb = await ToPbScoreDocument(row);

			return TachiScoreDataToBeatorajaFormat(
				pb as PBScoreDocument<BMSGames>,
				chartData.sha256,
				user.id === requestedBy ? "" : user.username,
				chartData.notecount,
				0,
			);
		}),
	);

	return scores.filter((score) => score !== null);
}

/**
 * Returns all configured Tachi rivals that can be represented through beatoraja's
 * game-wide rival API.
 *
 * @name GET /ir/beatoraja/rivals
 */
router.get("/rivals", async (req, res) => {
	const userID = NotNullish(req[SYMBOL_TACHI_API_AUTH].userID);
	const rivals = await GetBeatorajaRivalUsers(userID);

	return res.status(200).json({
		success: true,
		description: `Returned ${rivals.length} rivals.`,
		body: rivals.map((rival) => ({
			id: `${rival.id}`,
			name: rival.username,
			rank: "",
		})),
	});
});

/**
 * Exports every Beatoraja-compatible PB for a player. The beatoraja client uses
 * this for initial local score import and rival score database hydration.
 *
 * @name GET /ir/beatoraja/players/:userID/scores
 */
router.get("/players/:userID/scores", async (req, res) => {
	const userID = NotNullish(req[SYMBOL_TACHI_API_AUTH].userID);
	const user = await ResolveUser(req.params.userID);

	if (!user) {
		return res.status(404).json({
			success: false,
			description: `User does not exist.`,
		});
	}

	const permittedUserIDs = await GetPermittedBeatorajaUserIDs(userID);

	if (!permittedUserIDs.has(user.id)) {
		return res.status(403).json({
			success: false,
			description: `Cannot export scores for a player that is not you or your rival.`,
		});
	}

	const scores = await FormatBeatorajaPbsForUser(user, userID);

	return res.status(200).json({
		success: true,
		description: `Successfully returned ${scores.length} scores.`,
		body: scores,
	});
});

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
		// the chart and score values were at least typed correctly
		// and can afford to make this assertion.
		if (type === "SongOrChartNotFound") {
			const { chart } = req.safeBody as { chart: BeatorajaChart };

			const orphanRow = await DB.selectFrom("orphan_chart")
				.select("orphan_chart.id")
				.where(sql`orphan_chart.chart_doc->'data'->>'hashSHA256'`, "=", chart.sha256)
				.executeTakeFirst();

			const orphanUserCount =
				orphanRow === undefined
					? null
					: Number(
							(
								await DB.selectFrom("orphan_chart_user")
									.select((eb) => eb.fn.countAll<number>().as("c"))
									.where("orphan_chart_id", "=", orphanRow.id)
									.executeTakeFirst()
							)?.c ?? 0,
						);

			if (orphanUserCount === null) {
				log.warn(
					{
						body: req.safeBody as unknown,
					},
					`Chart '${chart.sha256}' got SongOrChartNotFound, but was not orphaned?`,
				);

				return res.status(400).json({
					success: false,
					description: "This chart is not supported.",
				});
			}

			return res.status(202).json({
				success: true,
				description: `Chart and score have been orphaned. This chart will be un-orphaned when ${ServerConfig.BEATORAJA_QUEUE_SIZE} players have played the chart (Currently: ${orphanUserCount}).`,
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

	const scoreDoc = await LoadScoreDocumentById(importRes.body.body.scoreIDs[0]);

	if (!scoreDoc) {
		log.error(
			`Score ${importRes.body.body.scoreIDs[0]} was claimed to be inserted, but wasn't.`,
		);
		return res.status(500).json({
			success: false,
			description: "Internal Service Error.",
		});
	}

	const chart = await GetChartById(scoreDoc.chartID);

	if (!chart) {
		log.error(
			`Expected to find a chart with chartID ${scoreDoc.chartID} for game ${scoreDoc.game}, but found none?`,
		);

		return res.status(500).json({
			success: false,
			description: `Internal Service Error.`,
		});
	}

	const songRow = await GetSongByID(GameToGameGroup(scoreDoc.game), scoreDoc.songID);

	if (!songRow) {
		log.error(
			`Expected to find a song with legacy id ${scoreDoc.songID} in game ${scoreDoc.game}, but found none?`,
		);

		return res.status(500).json({
			success: false,
			description: `Internal Service Error.`,
		});
	}

	const song = songRow.doc;

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
				charts: (self) =>
					(Array.isArray(self) &&
						self.length === 4 &&
						self.every(
							(maybeChart: unknown) =>
								IsRecord(maybeChart) && typeof maybeChart.md5 === "string",
						)) ||
					"Expected an array of 4 objects with MD5 properties.",
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
					"Max",
				),
				option: p.isInteger,
				lntype: p.isIn(0, 1, 2),
			},
		},
		{},
		{ allowExcessKeys: true },
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
				lntype: 0 | 1 | 2;
				option: integer;
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

		const course = await DB.selectFrom("bms_course_lookup")
			.select(["bms_course_lookup.set", "bms_course_lookup.game", "bms_course_lookup.value"])
			.where("bms_course_lookup.md5sums", "=", combinedMD5s)
			.executeTakeFirst();

		if (!course) {
			return res.status(404).json({
				success: false,
				description: `Unsupported course.`,
			});
		}

		const userID = NotNullish(req[SYMBOL_TACHI_API_AUTH].userID);

		const result = await UpdateClassIfGreater(
			userID,
			course.game,
			course.set as Classes[GamesForGroup["bms"]],
			course.value,
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
	},
);

router.use("/charts/:chartSHA256", chartsRouter);

export default router;
