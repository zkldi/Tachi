import type { Game } from "tachi-db";

import { pgScoreDataToAPI } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import { EscapeForILIKE } from "#utils/misc";
import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { sql } from "kysely";
import { type PBReference, type PBScoreDocument, type V3Game } from "tachi-common";

/** Row shape from `pb` joined with `chart` and `song` for building a {@link PBScoreDocument}. */
export interface PbDocumentJoinRow {
	row_id: string;
	user_id: number;
	lens: string | null;
	data: unknown;
	derived_data: unknown;
	calculated_data: unknown;
	judgements: unknown;
	ranking_value: number;
	ranking_value_tb1: number | null;
	ranking_value_tb2: number | null;
	ranking_value_tb3: number | null;
	ranking_value_tb4: number | null;
	ranking_value_tb5: number | null;
	highlight: boolean;
	time_achieved: string | null;
	chart_id: string;
	song_id: string;
	chart_game: Game;
	is_primary: boolean;
	/** From `chart_leaderboard` (window rank / count on this chart + lens). */
	leaderboard_rank: number;
	leaderboard_out_of: number;
}

/** All columns from `pb` for single-table reads (e.g. updating `calculated_data`). */
export const SELECT_PB_ROW = [
	"pb.row_id",
	"pb.user_id",
	"pb.chart_id",
	"pb.lens",
	"pb.data",
	"pb.derived_data",
	"pb.calculated_data",
	"pb.judgements",
	"pb.ranking_value",
	"pb.ranking_value_tb1",
	"pb.ranking_value_tb2",
	"pb.ranking_value_tb3",
	"pb.ranking_value_tb4",
	"pb.ranking_value_tb5",
	"pb.highlight",
	"pb.time_achieved",
] as const;

/** Columns for `pb` joined with `chart` and `song` (same shape as {@link PbDocumentJoinRow}). */
export const SELECT_PB_DOCUMENT_JOIN = [
	"pb.row_id",
	"pb.user_id",
	"pb.chart_id",
	"pb.lens",
	"pb.data",
	"pb.derived_data",
	"pb.calculated_data",
	"pb.judgements",
	"pb.ranking_value",
	"pb.ranking_value_tb1",
	"pb.ranking_value_tb2",
	"pb.ranking_value_tb3",
	"pb.ranking_value_tb4",
	"pb.ranking_value_tb5",
	"pb.highlight",
	"pb.time_achieved",
	"chart.id as chart_id",
	"song.id as song_id",
	"chart.game as chart_game",
	"chart.is_primary as is_primary",
] as const;

/** Columns from `chart_leaderboard` (must inner-join on `chart_leaderboard.row_id = pb.row_id`). */
export const SELECT_PB_LEADERBOARD_EXTRA = [
	sql<number>`chart_leaderboard.rank`.as("leaderboard_rank"),
	sql<number>`chart_leaderboard.out_of`.as("leaderboard_out_of"),
] as const;

export const SELECT_PB_DOCUMENT_WITH_LEADERBOARD = [
	...SELECT_PB_DOCUMENT_JOIN,
	...SELECT_PB_LEADERBOARD_EXTRA,
] as const;

/**
 * Maps a Postgres `pb` row (+ chart/song join columns) to the legacy Mongo PB document shape.
 */
export async function ToPbScoreDocument(row: PbDocumentJoinRow): Promise<PBScoreDocument> {
	const composedRows = await DB.selectFrom("pb_composed_from")
		.where("pb_id", "=", row.row_id)
		.select(["score_id", "merge_name"])
		.execute();

	const composedFrom: [PBReference, ...PBReference[]] =
		composedRows.length > 0
			? (composedRows.map((c) => ({
					name: c.merge_name,
					scoreID: c.score_id,
				})) as [PBReference, ...PBReference[]])
			: [{ name: "Primary", scoreID: "unknown" }];

	const scoreData = pgScoreDataToAPI(
		row.chart_game as V3Game,
		{
			data: row.data,
			derived: row.derived_data,
			judgements: row.judgements,
		} as Parameters<typeof pgScoreDataToAPI>[1],
	);

	const rawCd = row.calculated_data;
	const cd = (rawCd ?? {}) as Record<string, unknown>;
	const rivalRank = typeof cd.rivalRank === "number" ? cd.rivalRank : null;

	return {
		composedFrom,
		rankingData: {
			rank: row.leaderboard_rank,
			outOf: row.leaderboard_out_of,
			rivalRank,
		},
		userID: row.user_id,
		chartID: row.chart_id,
		game: row.chart_game as V3Game,
		songID: row.song_id,
		highlight: row.highlight,
		isPrimary: row.is_primary,
		timeAchieved: row.time_achieved ? ISO8601ToUnixMilliseconds(row.time_achieved) : null,
		scoreData,
		calculatedData: (row.calculated_data ?? {}) as PBScoreDocument["calculatedData"],
	};
}

/** Best PB for a user on a chart. */
export async function GetPBOnChart(
	userID: number,
	chartID: string,
): Promise<PBScoreDocument | null> {
	const row = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "=", userID)
		.where("chart.id", "=", chartID)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToPbScoreDocument(row as PbDocumentJoinRow);
}

/** PBs for a user on any of the given charts (Postgres `chart.id`), newest `time_achieved` first. */
export async function LoadPbsForUserOnChartsByPgIds(
	userId: number,
	chartPgIds: string[],
	opts?: { limit?: number },
): Promise<PBScoreDocument[]> {
	if (chartPgIds.length === 0) {
		return [];
	}

	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "=", userId)
		.where("chart.id", "in", chartPgIds)
		.orderBy("pb.time_achieved", "desc")
		.limit(opts?.limit ?? 30)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/** PBs for a user on all charts of a song in this GPT (`chart.game` + `song.id`), newest `time_achieved` first. */
export async function LoadPbsForUserOnSongPgId(
	userId: number,
	v3Game: Game,
	songPgId: string,
): Promise<PBScoreDocument[]> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "=", userId)
		.where("chart.game", "=", v3Game)
		.where("chart.song_id", "=", songPgId)
		.orderBy("pb.time_achieved", "desc")
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/** Every PB on a chart (Postgres `chart.id`), e.g. beatoraja IR leaderboard. */
export async function LoadAllPbsForChartPgId(chartPgId: string): Promise<PBScoreDocument[]> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartPgId)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/** All PBs for a user on primary charts for this GPT (`chart.game` + `is_primary`). */
export async function LoadPbDocumentsForUserPrimaryCharts(
	userId: number,
	v3Game: Game,
): Promise<PBScoreDocument[]> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "=", userId)
		.where("chart.game", "=", v3Game)
		.where("chart.is_primary", "=", true)
		.orderBy("pb.time_achieved", "desc")
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/** Primary-chart PBs for a user, sorted by a numeric field in `calculated_data` (descending). */
export async function LoadPbDocumentsForUserPrimaryChartsSortedByAlg(
	userId: number,
	v3Game: Game,
	alg: string,
	limit: number,
): Promise<PBScoreDocument[]> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "=", userId)
		.where("chart.game", "=", v3Game)
		.where("chart.is_primary", "=", true)
		.orderBy(
			sql`(pb.calculated_data::jsonb->>${sql.lit(alg)})::double precision DESC NULLS LAST`,
		)
		.orderBy("pb.time_achieved", "desc")
		.limit(limit)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/**
 * Top PBs in this GPT (`chart.game`), sorted by a numeric field in `calculated_data`
 * (descending). Matches legacy Mongo `personal-bests` queries for the GPT PB leaderboard.
 */
export async function LoadPbDocumentsForGameSortedByCalculatedAlg(
	v3Game: Game,
	alg: string,
	limit: number,
): Promise<PBScoreDocument[]> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.game", "=", v3Game)
		.where("pb.lens", "is", null)
		.orderBy(
			sql`(pb.calculated_data::jsonb->>${sql.lit(alg)})::double precision DESC NULLS LAST`,
		)
		.orderBy("pb.time_achieved", "desc")
		.limit(limit)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/**
 * PBs for any of the given users in this GPT (`chart.game`), sorted by a numeric field in
 * `calculated_data` (descending). Matches legacy Mongo `personal-bests` queries that did not
 * filter to primary charts only.
 */
export async function LoadPbDocumentsForUserSetSortedByCalculatedAlg(
	userIds: number[],
	v3Game: Game,
	alg: string,
	limit: number,
): Promise<PBScoreDocument[]> {
	if (userIds.length === 0) {
		return [];
	}

	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "in", userIds)
		.where("chart.game", "=", v3Game)
		.where("pb.lens", "is", null)
		.orderBy(
			sql`(pb.calculated_data::jsonb->>${sql.lit(alg)})::double precision DESC NULLS LAST`,
		)
		.orderBy("pb.time_achieved", "desc")
		.limit(limit)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/** PBs for a set of users on one chart (Postgres `chart.id`). */
export async function LoadPbsByUserIdsAndChartPgId(
	userIds: number[],
	chartPgId: string,
): Promise<PBScoreDocument[]> {
	if (userIds.length === 0) {
		return [];
	}

	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartPgId)
		.where("pb.user_id", "in", userIds)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/**
 * Top-ranked PB on a chart (best `ranking_value`)
 */
export async function GetServerRecordOnChart(chartID: string): Promise<PBScoreDocument | null> {
	const row = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartID)
		.orderBy("pb.ranking_value", "desc")
		.limit(1)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToPbScoreDocument(row as PbDocumentJoinRow);
}

/** PBs on a chart with leaderboard rank strictly above / below the user’s rank (USC-style ladders). */
export async function LoadPbsAdjacentByChartRank(
	chartID: string,
	userRank: number,
	dir: "above" | "below",
	limit: number,
): Promise<Array<PBScoreDocument>> {
	const rankExpr = sql<number>`chart_leaderboard.rank`;
	const cmp =
		dir === "above"
			? sql<boolean>`${rankExpr} < ${userRank}`
			: sql<boolean>`${rankExpr} > ${userRank}`;
	const order = dir === "above" ? ("desc" as const) : ("asc" as const);

	const q = DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartID)
		.where(cmp)
		.orderBy(rankExpr, order)
		.limit(limit);

	const rows = await q.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/** PB with ladder rank 1 on a chart */
export async function LoadPbRankOneOnChartID(chartID: string): Promise<PBScoreDocument | null> {
	const row = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartID)
		.where(sql<boolean>`chart_leaderboard.rank = 1`)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToPbScoreDocument(row as PbDocumentJoinRow);
}

/** Top N PBs on a chart by `ranking_value` (matches USC score ordering for leaderboard). */
export async function LoadPbsOnChartByRankingValueDesc(
	chartLegacyId: string,
	limit: number,
): Promise<Array<PBScoreDocument>> {
	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartLegacyId)
		.orderBy("pb.ranking_value", "desc")
		.limit(limit)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}
/**
 * PBs on a chart with leaderboard rank &gt;= `startRanking`, sorted by rank ascending
 * (legacy GET …/charts/:chartID/pbs).
 */
export async function LoadPbsOnChartByRankAsc(
	chartLegacyId: string,
	startRanking: number,
	limit: number,
): Promise<Array<PBScoreDocument>> {
	const rankExpr = sql<number>`chart_leaderboard.rank`;

	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartLegacyId)
		.where(sql<boolean>`${rankExpr} >= ${startRanking}`)
		.orderBy(rankExpr, "asc")
		.limit(limit)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

/**
 * PBs on a chart for accounts matching the v1 username search (ILIKE on
 * `normalized_username`, limit 25). Username filter is folded into this query via
 * `IN (SELECT id FROM account …)`.
 */
export async function LoadPbsOnChartForUserSearch(
	chartLegacyId: string,
	search: string,
): Promise<Array<PBScoreDocument>> {
	const likeEsc = EscapeForILIKE(search.toLowerCase());
	const pattern = `%${likeEsc}%`;

	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("chart.id", "=", chartLegacyId)
		.where(
			sql<boolean>`pb.user_id IN (
				SELECT id FROM account
				WHERE normalized_username LIKE ${pattern}
				LIMIT 25
			)`,
		)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}
