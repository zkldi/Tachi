import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { sql } from "kysely";

interface LeaderboardPartition {
	chart_id: string;
	lens: string | null;
}

/**
 * Rebuild chart_leaderboard partitions that are missing cached rows.
 *
 * Normal writes are maintained by pb triggers, but seed/dataset restores can
 * arrive with pb rows and no chart_leaderboard rows. Downstream PB/profile
 * queries use an inner join on chart_leaderboard, so missing rows make valid PBs
 * disappear from recalculation until the partition is refreshed.
 */
export async function ReconcileChartLeaderboardJob(): Promise<number> {
	const missingPartitions = await sql<LeaderboardPartition>`
		SELECT DISTINCT
			pb.chart_id,
			pb.lens
		FROM pb
		LEFT JOIN chart_leaderboard AS cl ON cl.row_id = pb.row_id
		WHERE cl.row_id IS NULL
	`.execute(DB);

	for (const partition of missingPartitions.rows) {
		await sql`
			SELECT refresh_chart_leaderboard_partition(
				${partition.chart_id},
				${partition.lens}
			)
		`.execute(DB);
	}

	if (missingPartitions.rows.length > 0) {
		log.info(
			`ReconcileChartLeaderboard done: ${missingPartitions.rows.length} partition(s) refreshed.`,
		);
	}

	return missingPartitions.rows.length;
}
