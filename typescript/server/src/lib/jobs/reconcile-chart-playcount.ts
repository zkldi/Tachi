import { log } from "#lib/log/log";
import DB from "#services/pg/db";
import { sql } from "kysely";

/** Recompute chart_playcount rows that drifted from live score counts. */
export async function ReconcileChartPlaycountJob() {
	log.info("Starting ReconcileChartPlaycount job.");

	const driftRows = await sql<{ chart_id: string; live_count: number }>`
		SELECT
			score.chart_id,
			COUNT(*)::int AS live_count
		FROM score
		LEFT JOIN chart_playcount AS cp ON cp.chart_id = score.chart_id
		GROUP BY score.chart_id, cp.playcount
		HAVING COUNT(*)::int IS DISTINCT FROM COALESCE(cp.playcount, 0)
	`.execute(DB);

	let fixed = 0;

	for (const row of driftRows.rows) {
		await DB.insertInto("chart_playcount")
			.values({
				chart_id: row.chart_id,
				playcount: row.live_count,
			})
			.onConflict((oc) =>
				oc.column("chart_id").doUpdateSet({
					playcount: row.live_count,
				}),
			)
			.execute();
		fixed++;
	}

	const staleRows = await sql<{ chart_id: string }>`
		SELECT cp.chart_id
		FROM chart_playcount AS cp
		LEFT JOIN score ON score.chart_id = cp.chart_id
		GROUP BY cp.chart_id
		HAVING COUNT(score.id) = 0
	`.execute(DB);

	for (const row of staleRows.rows) {
		await DB.deleteFrom("chart_playcount")
			.where("chart_playcount.chart_id", "=", row.chart_id)
			.execute();
		fixed++;
	}

	log.info(
		`ReconcileChartPlaycount done: ${fixed} row(s) corrected (${driftRows.rows.length} drift, ${staleRows.rows.length} stale).`,
	);
}
