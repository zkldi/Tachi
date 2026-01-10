import { Router } from "express";
import db from "external/mongo/db";
import { CUSTOM_TACHI_IIDX_PLAYLISTS } from "lib/game-specific/iidx-playlists";
import { ResolveSongAndChart } from "lib/score-import/import-types/common/batch-manual/converter";
import { EAM_VERSION_NAMES } from "lib/score-import/import-types/common/eamusement-iidx-csv/parser";
import { AggressiveRateLimitMiddleware } from "server/middleware/rate-limiter";
import { ValidatePlaytypeFromParamFor } from "server/router/api/v1/games/_game/_playtype/middleware";
import { GetUser } from "utils/req-tachi-data";
import type { TachiIIDXPlaylist } from "lib/game-specific/iidx-playlists";
import type {
	ChartDocument,
	PBScoreDocument,
	Playtypes,
	SongDocument,
	integer,
} from "tachi-common";
import type { GetEnumValue } from "tachi-common/types/metrics";

const router: Router = Router({ mergeParams: true });

const EAMUSEMENT_CSV_HEADER = `バージョン,タイトル,ジャンル,アーティスト,プレー回数,BEGINNER 難易度,BEGINNER スコア,BEGINNER PGreat,BEGINNER Great,BEGINNER ミスカウント,BEGINNER クリアタイプ,BEGINNER DJ LEVEL,NORMAL 難易度,NORMAL スコア,NORMAL PGreat,NORMAL Great,NORMAL ミスカウント,NORMAL クリアタイプ,NORMAL DJ LEVEL,HYPER 難易度,HYPER スコア,HYPER PGreat,HYPER Great,HYPER ミスカウント,HYPER クリアタイプ,HYPER DJ LEVEL,ANOTHER 難易度,ANOTHER スコア,ANOTHER PGreat,ANOTHER Great,ANOTHER ミスカウント,ANOTHER クリアタイプ,ANOTHER DJ LEVEL,LEGGENDARIA 難易度,LEGGENDARIA スコア,LEGGENDARIA PGreat,LEGGENDARIA Great,LEGGENDARIA ミスカウント,LEGGENDARIA クリアタイプ,LEGGENDARIA DJ LEVEL,最終プレー日時`;

function ConvertEamGrade(grade: GetEnumValue<"iidx:DP" | "iidx:SP", "grade">) {
	// eamusement has no concept of max or max-.
	if (grade === "MAX" || grade === "MAX-") {
		return "AAA";
	}

	return grade;
}

function ConvertEamLamp(lamp: GetEnumValue<"iidx:DP" | "iidx:SP", "lamp">) {
	if (lamp === "FULL COMBO") {
		return "FULLCOMBO CLEAR"; // weird, but ok
	}

	return lamp;
}

/**
 * Retrieve this users PBs in eamusement CSV format.
 *
 * @name GET /api/v1/users/:userID/games/iidx/:playtype/eamusement-csv
 */
router.get(
	"/:playtype/eamusement-csv",
	ValidatePlaytypeFromParamFor("iidx"),
	AggressiveRateLimitMiddleware,
	async (req, res) => {
		const game = "iidx";

		const playtype = req.params.playtype as Playtypes["iidx"];
		const user = GetUser(req);

		const pbData: Array<{
			_id: integer;
			pbs: Array<PBScoreDocument<"iidx:DP" | "iidx:SP">>;
			song: SongDocument<"iidx">;
		}> = await db["personal-bests"].aggregate([
			{
				$match: {
					userID: user.id,
					game,
					playtype,
					isPrimary: true,
				},
			},
			{
				$group: {
					// group our scores on the song
					_id: "$songID",
					pbs: { $push: "$$ROOT" },
				},
			},
			{
				$lookup: {
					from: "songs-iidx",
					foreignField: "id",
					localField: "_id",
					as: "song",
				},
			},
			{
				$unwind: "$song",
			},
		]);

		const rows = [EAMUSEMENT_CSV_HEADER];

		// get all relevant charts
		const charts = await db.charts.iidx.find({
			songID: { $in: pbData.map((e) => e.song.id) },
			difficulty: { $in: ["NORMAL", "HYPER", "ANOTHER", "LEGGENDARIA"] },
		});

		// get a lookup table for songID + difficulty -> chart.
		const chartMap = new Map<string, ChartDocument>();

		for (const chart of charts) {
			chartMap.set(`${chart.songID}-${chart.difficulty}`, chart);
		}

		for (const { pbs, song } of pbData) {
			let version = "UNKNOWN";
			const tachiVer = song.data.displayVersion;

			if (tachiVer !== null) {
				// @ts-expect-error We're abusing enums which already aren't meant
				// for this kind of lookup task. Ah well!
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				version = EAM_VERSION_NAMES[tachiVer] ?? tachiVer;
			}

			const row = [
				version,
				song.title,
				song.data.genre,
				song.artist,
				"0", // always 0, who cares?
			];

			let lastPlayed = 0;

			for (const difficulty of [
				"BEGINNER",
				"NORMAL",
				"HYPER",
				"ANOTHER",
				"LEGGENDARIA",
			] as const) {
				const chart = chartMap.get(`${song.id}-${difficulty}`);
				let pb;

				// this song might not have a beginner/normal/hyper/another/legg
				if (chart) {
					// try and find the user's PB
					pb = pbs.find((e) => e.chartID === chart.chartID);
				}

				if (pb) {
					row.push(
						chart ? chart.level : "0",
						pb.scoreData.score.toString(), // ex
						pb.scoreData.judgements.pgreat?.toString() ?? "0", // pgreat
						pb.scoreData.judgements.great?.toString() ?? "0", // great
						pb.scoreData.optional.bp?.toString() ?? "0", // BP
						ConvertEamLamp(pb.scoreData.lamp), // lamp
						ConvertEamGrade(pb.scoreData.grade) // grade
					);

					if (pb.timeAchieved !== null && lastPlayed < pb.timeAchieved) {
						lastPlayed = pb.timeAchieved;
					}
				} else {
					row.push(
						chart ? chart.level : "0",
						"0", // ex
						"0", // pgreat
						"0", // great
						"---", // BP
						"NO PLAY", // lamp
						"---" // grade
					);
				}
			}

			// last played. This will be 1970-01-01 if this user has never played this chart
			// with a timestamp.
			row.push(new Date(lastPlayed).toISOString());

			// IIDX uses a "naive" CSV format. that is to say -- there's no escaping.
			// God forbid a song title like "19, november" get output here, because it will
			// just break the format. That's what the official site does though.
			// bug-for-bug compatibility!
			// at the very least, we'll replace , with \,. That should be fine.
			rows.push(row.map((e) => e.replace(/,/gu, "\\,")).join(","));
		}

		return res.status(200).json({
			success: true,
			description: `Created e-amusement CSV.`,
			body: rows.join("\n"),
		});
	}
);

/**
 * Retrieve this playlist.
 *
 * @name GET /api/v1/users/:userID/games/iidx/:playtype/playlists/:playlistID
 */
router.get("/:playtype/playlists/:playlistID", async (req, res) => {
	const user = GetUser(req);

	const playlist: TachiIIDXPlaylist | undefined = CUSTOM_TACHI_IIDX_PLAYLISTS.find(
		(e) =>
			(e.playtype === null || e.playtype === req.params.playtype) &&
			e.urlName === req.params.playlistID
	);

	if (!playlist) {
		return res.status(404).json({
			success: false,
			description: `No such playlist '${req.params.playlistID}' exists for '${req.params.playtype}'.`,
		});
	}

	if (playlist.forSpecificUser !== true) {
		return res.status(404).json({
			success: false,
			description: `This playlist is not for a specific user. Use the /games/:game endpoint instead.`,
		});
	}

	const body = await playlist.getPlaylists(user.id, req.params.playtype as "DP" | "SP");

	return res.status(200).json(body);
});

export default router;
