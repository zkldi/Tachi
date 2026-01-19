import chartIDRouter from "./_chartID/router";
import { Router } from "express";
import db from "external/mongo/db";
import { SYMBOL_TACHI_API_AUTH } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { ResolveSongAndChart } from "lib/score-import/import-types/common/batch-manual/converter";
import { SearchSpecificGameSongs } from "lib/search/search";
import prValidate from "server/middleware/prudence-validate";
import { type ChartDocument, type integer, type MatchTypes } from "tachi-common";
import { PR_RESOLVER } from "tachi-common/lib/schemas";
import { IsString } from "utils/misc";
import { FindChartsOnPopularity } from "utils/queries/charts";
import { GetGPT } from "utils/req-tachi-data";
import type { MatchTypeResolver, UGPTSettingsDocument } from "tachi-common";

const logger = CreateLogCtx(__filename);
const router: Router = Router({ mergeParams: true });

/**
 * Searches for charts on this game - if no search parameter is given,
 * returns the 100 most popular charts for this game.
 *
 * @param search - The song title to match on.
 * @param noIntelligentOmit - If present, will not perform intelligent
 * chart omissions from results.
 * @param requesterHasPlayed - If present, will only return charts the
 * requesting user has a PB on. If this request doesn't belong to a user,
 * this returns 401.
 *
 * @name GET /api/v1/games/:game/:playtype/charts
 */
router.get("/", async (req, res) => {
	const { game, playtype } = GetGPT(req);

	let songIDs: Array<integer> | undefined;

	if (IsString(req.query.search)) {
		const songs = await SearchSpecificGameSongs(game, req.query.search, 100);

		songIDs = songs.map((e) => e.id);
	}

	if (IsString(req.query.requesterHasPlayed)) {
		const userID = req[SYMBOL_TACHI_API_AUTH].userID;

		if (userID === null) {
			return res.status(401).json({
				success: false,
				description: `You must be authorised as a user to use the requesterHasPlayed option.`,
			});
		}

		const playedSongs = (
			await db["personal-bests"].find(
				{ userID, game, playtype },
				{ projection: { songID: 1 } }
			)
		).map((e) => e.songID);

		if (songIDs) {
			songIDs = songIDs.filter((e) => playedSongs.includes(e));
		} else {
			songIDs = playedSongs;
		}
	}

	const skip = 0;
	const limit = 100;

	let charts = (await FindChartsOnPopularity(
		game,
		playtype,

		// if empty, we want the set of all songs. Otherwise, constrict input.
		songIDs,
		skip,
		limit,
		"personal-bests"
	)) as Array<ChartDocument>;

	// @optimisable
	// could use songIDs from above instead of refetching
	// but this is not very expensive.
	const songs = await db.anySongs[game].find({
		id: { $in: charts.map((e) => e.songID) },
	});

	// Edge case.
	// If the game is IIDX and the player does not want
	// to see 2dxtra charts, we need to remove them from the
	// result of a search.
	//
	// Since most players will have this off, this is not a significant
	// performance hit.
	if (game === "iidx" && req.query.noIntelligentOmit === undefined) {
		if (req[SYMBOL_TACHI_API_AUTH].userID === null) {
			charts = charts.filter(
				(e) => (e as ChartDocument<"iidx:DP" | "iidx:SP">).data["2dxtraSet"] === null
			);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			const iidxSettings = (await db["game-settings"].findOne({
				userID: req[SYMBOL_TACHI_API_AUTH].userID,
				game,
				playtype,
			})) as UGPTSettingsDocument<"iidx:DP" | "iidx:SP"> | null;

			if (!iidxSettings?.preferences.gameSpecific.display2DXTra) {
				charts = charts.filter(
					(e) => (e as ChartDocument<"iidx:DP" | "iidx:SP">).data["2dxtraSet"] === null
				);
			}
		}
	}

	return res.status(200).json({
		success: true,
		description: `Returned ${charts.length} charts.`,
		body: {
			charts,
			songs,
		},
	});
});

/**
 * Use the tachi "resolve" engine to identify a chart instead of
 * using the Tachi IDs. Used to get a chart.
 *
 * @name POST /api/v1/users/:userID/games/:game/:playtype/pbs/resolve
 */
router.post("/resolve", prValidate(PR_RESOLVER), async (req, res) => {
	const { game, playtype } = GetGPT(req);

	const safeBody = {
		...req.safeBody,
		game,
		playtype,
	} as unknown as MatchTypeResolver;
	const got = await ResolveSongAndChart(safeBody, logger);

	if (!got) {
		return res.status(404).json({
			success: false,
			description: `Could not resolve this chart with details: ${safeBody.matchType}:${safeBody.identifier} (Extra specifiers: version=${safeBody.version}, artist=${safeBody.artist})`,
		});
	}

	return res.status(200).json({
		success: true,
		description: "Successfully retrieved chart info.",
		body: {
			chart: got.chart,
			song: got.song,
		},
	});
});

router.use("/:chartID", chartIDRouter);

export default router;
