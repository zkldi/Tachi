import { log } from "#lib/log/log";
import { RecalculatePbsForChartsFromPostgresScores } from "#lib/score-import/framework/pb/process-pbs";
import DB from "#services/pg/db";
import { sql } from "kysely";
import { GameToGameGroup, type integer, type V3Game } from "tachi-common";

/**
 * Completely resets a user's game profile.
 *
 * This function is dangerous! Should only be ran by admins.
 */
export default async function DestroyUserGameProfile(userID: integer, game: V3Game) {
	await DB.deleteFrom("game_stats_snapshot")
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.execute();

	const chartRows = await DB.selectFrom("pb")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.select("chart.id")
		.where("pb.user_id", "=", userID)
		.where("chart.game", "=", game)
		.where("pb.lens", "is", null)
		.execute();

	const scoreChartRows = await DB.selectFrom("raw_score")
		.innerJoin("chart", "chart.id", "raw_score.chart_id")
		.select("chart.id")
		.where("raw_score.user_id", "=", userID)
		.where("chart.game", "=", game)
		.execute();

	const chartIDs = [
		...new Set([...chartRows.map((r) => r.id), ...scoreChartRows.map((r) => r.id)]),
	];

	const scoreRows = await DB.selectFrom("raw_score")
		.innerJoin("chart", "chart.id", "raw_score.chart_id")
		.select("raw_score.id")
		.where("raw_score.user_id", "=", userID)
		.where("chart.game", "=", game)
		.execute();

	const scoreIds = scoreRows.map((r) => r.id);

	if (scoreIds.length > 0) {
		await DB.deleteFrom("pb_composed_from").where("score_id", "in", scoreIds).execute();

		await DB.deleteFrom("raw_score").where("id", "in", scoreIds).execute();
	}

	const pbRowIds = await DB.selectFrom("pb")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.select("pb.row_id")
		.where("pb.user_id", "=", userID)
		.where("chart.game", "=", game)
		.execute();

	const pbIds = pbRowIds.map((r) => r.row_id);

	if (pbIds.length > 0) {
		await DB.deleteFrom("pb_composed_from").where("pb_id", "in", pbIds).execute();

		await DB.deleteFrom("pb").where("row_id", "in", pbIds).execute();
	}

	if (chartIDs.length > 0) {
		await RecalculatePbsForChartsFromPostgresScores(game, chartIDs, log);
	}

	await DB.deleteFrom("session").where("user_id", "=", userID).where("game", "=", game).execute();

	await DB.deleteFrom("import_game")
		.where("game", "=", game)
		.where("id", "in", (eb) =>
			eb
				.selectFrom("import")
				.select("id")
				.where("user_id", "=", userID)
				.where("game_group", "=", GameToGameGroup(game)),
		)
		.execute();

	await sql`
		DELETE FROM import AS i
		WHERE i.user_id = ${userID}
		AND i.game_group = ${GameToGameGroup(game)}
		AND NOT EXISTS (SELECT 1 FROM import_game ig WHERE ig.id = i.id)
	`.execute(DB);

	await DB.deleteFrom("game_rival")
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.execute();

	await DB.deleteFrom("game_profile")
		.where("user_id", "=", userID)
		.where("game", "=", game)
		.execute();
}
