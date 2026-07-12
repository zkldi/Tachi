import type { KtLogger } from "#lib/log/log";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { SELECT_CHART, ToChartDocument } from "#lib/db-formats/chart";
import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import DB from "#services/pg/db";
import fjsh from "fast-json-stable-hash";
import { sql } from "kysely";

const BATCH_SIZE = 5000;

/**
 * Re-derive `derived_data` and `calculated_data` for every score on the
 * given chart (by Postgres `chart.id`). This is called when chart data
 * changes in a way that affects score derivation (detected via
 * `derivation_checksum`).
 *
 * Each score UPDATE fires the `score_pb_dirty` trigger, so PB
 * recalculation is handled automatically.
 *
 * Scores whose derived/calculated values are unchanged are skipped entirely
 * (no UPDATE, no trigger fires) via a stable-hash comparison.
 *
 * Changed scores are bulk-updated in a single transaction per page with
 * `SET LOCAL synchronous_commit = off`, avoiding a WAL fsync per row and
 * making site-wide recalcs significantly faster on slow/network storage.
 * On crash the uncommitted page simply stays in `score_rederive` and is
 * retried idempotently.
 */
export async function rederiveScoresForChart(chartId: string, log: KtLogger): Promise<number> {
	const chartRow = await DB.selectFrom("chart")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_CHART)
		.where("chart.id", "=", chartId)
		.executeTakeFirst();

	if (!chartRow) {
		log.warn({ chartId }, "rederiveScoresForChart: chart not found, skipping.");
		return 0;
	}

	const chart = ToChartDocument(chartRow);
	const impl = GAME_IMPLEMENTATIONS[chart.game];

	let totalUpdated = 0;
	// Keyset pagination on score.id avoids O(N^2) offset scans on high-play charts.
	let lastId: string | null = null;

	while (true) {
		// eslint-disable-next-line no-await-in-loop
		const rows = await DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.leftJoin("import", "import.id", "score.import_id")
			.select(SELECT_SCORE_DOCUMENT)
			.where("score.chart_id", "=", chartId)
			// eslint-disable-next-line no-loop-func
			.$if(lastId !== null, (qb) => qb.where("score.id", ">", lastId!))
			.orderBy("score.id", "asc")
			.limit(BATCH_SIZE)
			.execute();

		if (rows.length === 0) {
			break;
		}

		const updates: Array<{ calculatedJson: string; derivedJson: string; id: string }> = [];

		for (const row of rows) {
			const score = ToScoreDocument(row as ScoreDocumentJoinRow);
			const rawRow = row as unknown as ScoreDocumentJoinRow;

			// game-specific union types aren't callable with the generic game,
			// so we cast through `any` the same way CreateScoreCalcData does.
			const derivedData = (impl.scoreDeriver as any)(score.scoreData, chart);

			const newScoreData = {
				...score.scoreData,
				...derivedData,
			};

			const calculatedData = (impl.scoreCalcs as any)(newScoreData, derivedData, chart);
			const { derived } = mongoScoreDataToPg(chart.game, newScoreData as any);

			// Skip scores that are already up-to-date. This avoids WAL writes and
			// the three downstream trigger inserts per unchanged row.
			// fjsh.hash produces a stable hash regardless of JSON key ordering.
			if (
				fjsh.hash(derived, "sha256") === fjsh.hash(rawRow.score_derived_data, "sha256") &&
				fjsh.hash(calculatedData, "sha256") ===
					fjsh.hash(rawRow.score_calculated_data, "sha256")
			) {
				continue;
			}

			updates.push({
				id: score.scoreID,
				derivedJson: JSON.stringify(derived),
				calculatedJson: JSON.stringify(calculatedData),
			});
		}

		if (updates.length > 0) {
			// Bulk-update all changed scores in one transaction.
			// SET LOCAL synchronous_commit = off prevents blocking on WAL fsync at commit;
			// normal app connections retain the default (synchronous_commit = on).
			// eslint-disable-next-line no-await-in-loop
			await DB.transaction().execute(async (trx) => {
				await sql`SET LOCAL synchronous_commit = off`.execute(trx);

				const valueFragments = updates.map(
					(u) =>
						sql`(${u.id}::text, ${u.derivedJson}::jsonb, ${u.calculatedJson}::jsonb)`,
				);

				await sql`
					UPDATE score
					SET derived_data = v.d,
						calculated_data = v.c
					FROM (VALUES ${sql.join(valueFragments, sql`, `)})
					AS v(score_id, d, c)
					WHERE score.id = v.score_id
				`.execute(trx);
			});
		}

		totalUpdated += updates.length;
		lastId = (rows[rows.length - 1] as unknown as ScoreDocumentJoinRow).score_id;

		if (rows.length < BATCH_SIZE) {
			break;
		}
	}

	if (totalUpdated > 0) {
		log.debug({ chartId, totalUpdated }, `Re-derived ${totalUpdated} score(s) for chart.`);
	}

	return totalUpdated;
}
