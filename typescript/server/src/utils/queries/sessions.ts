import { SELECT_CHART, ToChartDocument } from "#lib/db-formats/chart";
import { SELECT_SCORE_DOCUMENT, ToScoreDocument } from "#lib/db-formats/score";
import { SELECT_SESSION_DOCUMENT, ToSessionDocument } from "#lib/db-formats/session";
import { SELECT_SONG_DOCUMENT, ToSongDocument } from "#lib/db-formats/song";
import { GetSessionScoreInfo } from "#lib/score-import/framework/sessions/sessions";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { GetUserWithIDGuaranteed } from "#utils/user";
import _ from "lodash";
import {
	type ChartDocument,
	type ScoreDocument,
	type SessionDocument,
	type SessionScoreInfo,
	type SongDocument,
	type UserDocument,
} from "tachi-common";

/** Score ids attached to each session id (batch helper for session list endpoints). */
export async function GetScoreIdsGroupedBySessionId(
	sessionIds: Array<string>,
): Promise<Map<string, Array<string>>> {
	const map = new Map<string, Array<string>>();

	if (sessionIds.length === 0) {
		return map;
	}

	const rows = await DB.selectFrom("score")
		.select(["session_id", "id"])
		.where("session_id", "in", sessionIds)
		.execute();

	for (const r of rows) {
		if (!r.session_id) {
			continue;
		}

		const arr = map.get(r.session_id) ?? [];

		arr.push(r.id);
		map.set(r.session_id, arr);
	}

	return map;
}

/**
 * Returns the chronologically adjacent sessions (prev = older, next = newer)
 * for the same user and game, using (time_ended, id) as a deterministic sort key.
 */
export async function GetAdjacentSessions(
	session: SessionDocument,
): Promise<{ next: SessionDocument | null; prev: SessionDocument | null }> {
	const timeEnded = UnixMillisecondsToISO8601(session.timeEnded);

	const [newerRow, olderRow] = await Promise.all([
		DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("session.user_id", "=", session.userID)
			.where("session.game", "=", session.game)
			.where((eb) =>
				eb.or([
					eb("session.time_ended", ">", timeEnded),
					eb.and([
						eb("session.time_ended", "=", timeEnded),
						eb("session.id", ">", session.sessionID),
					]),
				]),
			)
			.orderBy("session.time_ended", "asc")
			.orderBy("session.id", "asc")
			.limit(1)
			.executeTakeFirst(),
		DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("session.user_id", "=", session.userID)
			.where("session.game", "=", session.game)
			.where((eb) =>
				eb.or([
					eb("session.time_ended", "<", timeEnded),
					eb.and([
						eb("session.time_ended", "=", timeEnded),
						eb("session.id", "<", session.sessionID),
					]),
				]),
			)
			.orderBy("session.time_ended", "desc")
			.orderBy("session.id", "desc")
			.limit(1)
			.executeTakeFirst(),
	]);

	return {
		next: newerRow ? ToSessionDocument(newerRow, []) : null,
		prev: olderRow ? ToSessionDocument(olderRow, []) : null,
	};
}

/**
 * Returns the 1-based chronological index of this session among all sessions
 * for the same user and game, using (time_ended, id) as the sort key.
 */
export async function GetSessionIndex(session: SessionDocument): Promise<number> {
	const timeEnded = UnixMillisecondsToISO8601(session.timeEnded);

	const row = await DB.selectFrom("session")
		.select(DB.fn.countAll<number>().as("count"))
		.where("session.user_id", "=", session.userID)
		.where("session.game", "=", session.game)
		.where((eb) =>
			eb.or([
				eb("session.time_ended", "<", timeEnded),
				eb.and([
					eb("session.time_ended", "=", timeEnded),
					eb("session.id", "<=", session.sessionID),
				]),
			]),
		)
		.executeTakeFirstOrThrow();

	return Number(row.count);
}

export async function GetSessionData(session: SessionDocument): Promise<{
	charts: Array<ChartDocument>;
	scoreInfo: Array<SessionScoreInfo>;
	scores: Array<ScoreDocument>;
	songs: Array<SongDocument>;
	user: UserDocument;
}> {
	const user = await GetUserWithIDGuaranteed(session.userID);

	const rows = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.select(SELECT_CHART)
		.select(SELECT_SONG_DOCUMENT)
		.where("score.session_id", "=", session.sessionID)
		.execute();

	let charts = rows.map(ToChartDocument);
	charts = _.uniqBy(charts, "chartID");

	let songs = rows.map(ToSongDocument);
	songs = _.uniqBy(songs, "id");

	let scores = rows.map(ToScoreDocument);
	scores = _.uniqBy(scores, "scoreID");

	const scoreInfo = await GetSessionScoreInfo(session);

	return {
		charts,
		scores,
		scoreInfo,
		songs,
		user,
	};
}
