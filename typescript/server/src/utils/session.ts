import type { ScoreDocument, SessionDocument } from "tachi-common";

import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { LoadSessionDocumentById } from "#lib/db-formats/session";
import DB from "#services/pg/db";

/**
 * Returns all the score documents inside a session.
 * @param session The session to retrieve the score documents of.
 */
export async function GetScoresFromSession(session: SessionDocument) {
	if (session.scoreIDs.length === 0) {
		return [];
	}

	const rows = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("score.id", "in", session.scoreIDs)
		.execute();

	return rows.map((row) => ToScoreDocument(row as ScoreDocumentJoinRow));
}

/**
 * Returns the session a score belongs to, if there is one. A score can only be part of one session implicitly.
 * @param score The score to return the associated session of.
 */
export async function GetSessionFromScore(score: ScoreDocument) {
	const row = await DB.selectFrom("score")
		.select("session_id")
		.where("id", "=", score.scoreID)
		.executeTakeFirst();

	if (!row?.session_id) {
		return null;
	}

	return LoadSessionDocumentById(row.session_id) ?? null;
}
