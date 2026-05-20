import type { Game } from "tachi-db";

import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import DB from "#services/pg/db";
import { sql } from "kysely";
import { GetGameConfig, type integer, type ScoreDocument, type V3Game } from "tachi-common";

/** Shared score + chart + song + import select used by activity and UGPT score queries. */
export function scoreDocumentJoin() {
	return DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT);
}

export async function GetRecentUGPTScores(userID: integer, game: V3Game, limit = 100) {
	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.orderBy(sql`score.time_achieved desc nulls last`)
		.limit(limit)
		.execute();

	return rows.map((row) => ToScoreDocument(row as ScoreDocumentJoinRow));
}

/**
 * Recent scores for a user/game/playtype, ordered by play time (`time_achieved`) descending
 * (Mongo `timeAchieved: -1` parity). Null play times sort last.
 */
export async function GetRecentUGPTScoresByTimeAchieved(
	userID: integer,
	game: V3Game,
	limit = 100,
) {
	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.orderBy(sql`score.time_achieved desc nulls last`)
		.limit(limit)
		.execute();

	return rows.map((row) => ToScoreDocument(row as ScoreDocumentJoinRow));
}

/** Scores for a user on the given Postgres chart ids, ordered by `time_achieved` desc (nulls last). */
export async function GetScoresForUserOnChartIDs(
	userID: integer,
	game: Game,
	chartIDs: string[],
	limit: number,
) {
	if (chartIDs.length === 0) {
		return [];
	}

	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.where("chart.id", "in", chartIDs)
		.orderBy(sql`score.time_achieved desc nulls last`)
		.limit(limit)
		.execute();

	return rows.map((row) => ToScoreDocument(row as ScoreDocumentJoinRow));
}

/** All scores for a user on primary charts only (`chart.is_primary`), unordered (Mongo `/scores/all` parity). */
export async function GetPrimaryScoresForUserUGPT(userID: integer, game: Game) {
	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.where("chart.is_primary", "=", true)
		.execute();

	return rows.map((row) => ToScoreDocument(row as ScoreDocumentJoinRow));
}

export async function GetRecentUGPTHighlights(userID: integer, game: V3Game, limit = 100) {
	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.where("score.highlight", "=", true)
		.orderBy(sql`score.time_achieved desc nulls last`)
		.limit(limit)
		.execute();

	return rows.map((row) => ToScoreDocument(row as ScoreDocumentJoinRow));
}

/**
 * For each chart in {@link chartIDs}, the earliest score (by play time; nulls last)
 * that satisfies `metric >= criteriaValue`, then ordered by play time with
 * null `timeAchieved` sorting as 0 (Mongo `/folders/.../timeline` parity).
 */
export async function GetFolderTimelineScores(
	userID: integer,
	game: V3Game,
	chartIDs: string[],
	metric: string,
	criteriaValue: number,
): Promise<Array<ScoreDocument>> {
	if (chartIDs.length === 0) {
		return [];
	}

	const gameConfig = GetGameConfig(game);
	const jsonBlob =
		gameConfig.derivedMetrics[metric] !== undefined ? sql`score.derived_data` : sql`score.data`;

	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.where("chart.id", "in", chartIDs)
		.where(sql<boolean>`(${jsonBlob}::jsonb->>${sql.lit(metric)})::numeric >= ${criteriaValue}`)
		.orderBy("score.chart_id")
		.orderBy(sql`coalesce(score.time_achieved, 'infinity'::timestamptz) asc`)
		.execute();

	const seen = new Set<string>();
	const picked: Array<ScoreDocumentJoinRow> = [];

	for (const row of rows) {
		const r = row as ScoreDocumentJoinRow;

		if (!seen.has(r.chart_id)) {
			seen.add(r.chart_id);
			picked.push(r);
		}
	}

	const scores = picked.map((r) => ToScoreDocument(r));

	scores.sort((a, b) => (a.timeAchieved ?? 0) - (b.timeAchieved ?? 0));

	return scores;
}

/**
 * Full score history on the charts, ordered like {@link GetFolderTimelineScores}: by `chart.id`,
 * then `time_achieved` ascending (unknown play time sorts last via infinity), then `time_added`.
 * Used by table evolution to detect strict PB increases per `(chart × metric)` in chronological order.
 */
export async function GetScoresForTableEvolution(
	userID: integer,
	game: V3Game,
	chartIDs: string[],
): Promise<Array<ScoreDocument>> {
	if (chartIDs.length === 0) {
		return [];
	}

	const rows = await scoreDocumentJoin()
		.where("score.user_id", "=", userID)
		.where("score.game", "=", game)
		.where("chart.id", "in", chartIDs)
		.orderBy("chart.id")
		.orderBy(sql`coalesce(score.time_achieved, 'infinity'::timestamptz) asc`)
		.orderBy("score.time_added", "asc")
		.execute();

	return rows.map((r) => ToScoreDocument(r as ScoreDocumentJoinRow));
}
