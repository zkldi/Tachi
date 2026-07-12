import type { RequestHandler } from "express";
import type { GetEnumValue } from "tachi-common/types/metrics";

import { SELECT_CHART } from "#lib/db-formats/chart";
import { SELECT_SONG_DOCUMENT } from "#lib/db-formats/song";
import {
	CUSTOM_TACHI_IIDX_PLAYLISTS,
	type TachiIIDXPlaylist,
} from "#lib/game-specific/iidx-playlists";
import { withGame, withRequestedUserAndReqData } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { EAM_VERSION_NAMES } from "#lib/score-import/import-types/common/eamusement-iidx-csv/parser";
import { AggressiveRateLimitMiddleware } from "#server/middleware/rate-limiter";
import { API_V1_ROUTER } from "#server/router/api/v1/_singleton";
import { GetUserFromParam } from "#server/router/api/v1/users/_userID/middleware";
import DB from "#services/pg/db";
import { REQ_AssignToReqTachiData, REQ_GetUser } from "#utils/req-tachi-data";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { ExpectedErr } from "bliss";
import _ from "lodash";
import {
	EnumIndexToValue,
	type GamesForGroup,
	GameToGameGroup,
	IsValidGame,
	type PgScoreData,
	type SongDocumentData,
	type V3Game,
} from "tachi-common";

const EAMUSEMENT_CSV_HEADER = `バージョン,タイトル,ジャンル,アーティスト,プレー回数,BEGINNER 難易度,BEGINNER スコア,BEGINNER PGreat,BEGINNER Great,BEGINNER ミスカウント,BEGINNER クリアタイプ,BEGINNER DJ LEVEL,NORMAL 難易度,NORMAL スコア,NORMAL PGreat,NORMAL Great,NORMAL ミスカウント,NORMAL クリアタイプ,NORMAL DJ LEVEL,HYPER 難易度,HYPER スコア,HYPER PGreat,HYPER Great,HYPER ミスカウント,HYPER クリアタイプ,HYPER DJ LEVEL,ANOTHER 難易度,ANOTHER スコア,ANOTHER PGreat,ANOTHER Great,ANOTHER ミスカウント,ANOTHER クリアタイプ,ANOTHER DJ LEVEL,LEGGENDARIA 難易度,LEGGENDARIA スコア,LEGGENDARIA PGreat,LEGGENDARIA Great,LEGGENDARIA ミスカウント,LEGGENDARIA クリアタイプ,LEGGENDARIA DJ LEVEL,最終プレー日時`;

function ConvertEamGrade(grade: GetEnumValue<GamesForGroup["iidx"], "grade">) {
	if (grade === "MAX" || grade === "MAX-") {
		return "AAA";
	}

	return grade;
}

function ConvertEamLamp(lamp: GetEnumValue<GamesForGroup["iidx"], "lamp">) {
	if (lamp === "FULL COMBO") {
		return "FULLCOMBO CLEAR";
	}

	return lamp;
}

const handleEamusementCsv: RequestHandler = async (req, res) => {
	const gameParam = req.params.game;
	if (!gameParam) {
		throw new ExpectedErr(400, "No game provided.");
	}
	if (!IsValidGame(gameParam)) {
		throw new ExpectedErr(400, `The game ${gameParam} is not supported.`);
	}
	if (GameToGameGroup(gameParam as V3Game) !== "iidx") {
		throw new ExpectedErr(404, `No e-amusement CSV exists for ${gameParam}.`);
	}

	const v3Game = gameParam as "iidx-dp" | "iidx-sp";
	const user = REQ_GetUser(req);

	const rows = [EAMUSEMENT_CSV_HEADER];

	const playerChartPbs = await DB.selectFrom("chart")
		.leftJoin("pb", "pb.chart_id", "chart.id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_SONG_DOCUMENT)
		.select(SELECT_CHART)
		.select([
			"pb.data as pb_data",
			"pb.derived_data as pb_derived_data",
			"pb.calculated_data as pb_calculated_data",
			"pb.time_achieved as pb_time_achieved",
			"pb.judgements as pb_judgements",
		])
		.where("game", "=", v3Game)
		.where("user_id", "=", user.id)
		.where(
			"chart.difficulty",
			// seems bizarre, but this is to exclude out 2dxtra charts.
			"in",
			["BEGINNER", "NORMAL", "HYPER", "ANOTHER", "LEGGENDARIA"],
		)
		.execute();

	const groupings = _.groupBy(playerChartPbs, "song_id");

	for (const [_songId, songPbs] of Object.entries(groupings)) {
		let version = "UNKNOWN";
		const firstChart = songPbs[0];
		const songData = firstChart.song_data as SongDocumentData["iidx"];
		const tachiVer = songData.displayVersion;

		if (tachiVer !== null) {
			// @ts-expect-error We're abusing enums which already aren't meant
			// for this kind of lookup task. Ah well!
			version = EAM_VERSION_NAMES[tachiVer] ?? tachiVer;
		}

		const songTitle = songData.eamusementCsvTitle ?? firstChart.song_title;
		const songArtist = songData.eamusementCsvArtist ?? firstChart.song_artist;
		const songGenre = songData.eamusementCsvGenre ?? songData.genre;

		const row = [
			version,
			songTitle,
			songGenre,
			songArtist,
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
			const pbInfo = songPbs.find((e) => e.chart_difficulty === difficulty);
			const pbData = pbInfo?.pb_data as
				| PgScoreData<"iidx-dp" | "iidx-sp">["data"]
				| null
				| undefined;
			const pbDerivedData = pbInfo?.pb_derived_data as
				| PgScoreData<"iidx-dp" | "iidx-sp">["derived"]
				| null
				| undefined;
			const pbJudgements = pbInfo?.pb_judgements as
				| PgScoreData<"iidx-dp" | "iidx-sp">["judgements"]
				| null
				| undefined;

			if (!pbInfo || !pbData || !pbDerivedData || !pbJudgements) {
				row.push(
					pbInfo?.chart_level ?? "0", // level
					"0", // ex
					"0", // pgreat
					"0", // great
					"---", // BP
					"NO PLAY", // lamp
					"---", // grade
				);
				continue;
			}

			row.push(
				pbInfo.chart_level ?? "0",
				pbData.score.toString(), // ex
				pbJudgements?.pgreat?.toString() ?? "0", // pgreat
				pbJudgements?.great?.toString() ?? "0", // great
				pbData.bp?.toString() ?? "0", // BP
				ConvertEamLamp(EnumIndexToValue(v3Game, "lamp", pbData.lamp)), // lamp
				ConvertEamGrade(EnumIndexToValue(v3Game, "grade", pbDerivedData.grade)), // grade
			);

			if (
				pbInfo.pb_time_achieved !== null &&
				lastPlayed < ISO8601ToUnixMilliseconds(pbInfo.pb_time_achieved)
			) {
				lastPlayed = ISO8601ToUnixMilliseconds(pbInfo.pb_time_achieved);
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
};

/**
 * Retrieve this users PBs in eamusement CSV format.
 *
 * @name GET /api/v1/users/:userID/games/iidx/:playtype/eamusement-csv
 */
API_V1_ROUTER.rawAdd(
	"GET",
	"/users/:userID/games/:game/eamusement-csv",
	GetUserFromParam,
	AggressiveRateLimitMiddleware,
	handleEamusementCsv,
);

/**
 * Retrieve this playlist.
 *
 * @name GET /api/v1/users/:userID/games/:game/playlists/:playlistID
 */
API_V1_ROUTER.add(
	"GET /users/:userID/games/:game/playlists/:playlistID",
	withRequestedUserAndReqData,
	withGame,
	async ({ ctx, params, res, req }) => {
		const { game } = ctx;
		const user = REQ_GetUser(req);

		if (GameToGameGroup(game) !== "iidx") {
			throw new ExpectedErr(404, `No playlists exist for ${game}.`);
		}

		// Maintain backwards-compat for any downstream expecting req tachi data.
		REQ_AssignToReqTachiData(req, { game });

		const playlist: TachiIIDXPlaylist | undefined = CUSTOM_TACHI_IIDX_PLAYLISTS.find(
			(e) => (e.game === null || e.game === game) && e.urlName === params.playlistID,
		);

		if (!playlist) {
			throw new ExpectedErr(
				404,
				`No such playlist '${params.playlistID}' exists for '${game}'.`,
			);
		}

		if (playlist.forSpecificUser !== true) {
			throw new ExpectedErr(
				404,
				`This playlist is not for a specific user. Use the /games/:game endpoint instead.`,
			);
		}

		const body = await playlist.getPlaylists(user.id, game as "iidx-dp" | "iidx-sp");
		res.status(200).json(body);
		return success("unused", null);
	},
);
