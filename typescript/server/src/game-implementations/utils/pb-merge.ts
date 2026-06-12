import type { PBMergeFunction } from "#game-implementations/types";
import type { PBScoreDocumentNoRank } from "#lib/score-import/framework/pb/create-pb-doc";
import type {
	ConfDerivedMetrics,
	ConfOptionalMetrics,
	ConfProvidedMetrics,
	ScoreDocument,
	V3Game,
} from "tachi-common";

import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import { scoreVisibleSql } from "#lib/score-import/framework/pg/score-visibility";
import DB from "#services/pg/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { sql } from "kysely";

// metrics available for this game
type MetricKeys<TGame extends V3Game> =
	| {
			metric: keyof ConfDerivedMetrics[TGame];
			type: "DERIVED";
	  }
	| {
			metric: keyof ConfOptionalMetrics[TGame] | keyof ConfProvidedMetrics[TGame];
			type: "REGULAR";
	  };

function metricSortValueSql<TGame extends V3Game>(metric: MetricKeys<TGame>) {
	if (metric.type === "DERIVED") {
		return sql`(score.derived_data::jsonb->>${sql.lit(metric.metric)})::double precision`;
	}

	return sql`(score.data::jsonb->>${sql.lit(metric.metric)})::double precision`;
}

function metricIsNumericSql<TGame extends V3Game>(metric: MetricKeys<TGame>) {
	if (metric.type === "DERIVED") {
		return sql<boolean>`jsonb_typeof(score.derived_data::jsonb -> ${sql.lit(metric.metric)}) = ${sql.lit("number")}`;
	}

	return sql<boolean>`jsonb_typeof(score.data::jsonb -> ${sql.lit(metric.metric)}) = ${sql.lit("number")}`;
}

/**
 * Utility for making a PB merge function. In short, get the best score this user has
 * on this chart for the stated metric, then run the applicator if a score was found.
 *
 * `metric` uses Postgres JSON keys on `score.data` / `score.derived_data` (see `mongoScoreDataToPg`).
 * For enum ordinals, use the metric name (e.g. `{ type: "REGULAR", metric: "lamp" }`), not `enumIndexes.*`.
 *
 * @param direction - Whether to pick the largest value or smallest value for this metric.
 */
export function CreatePBMergeFor<TGame extends V3Game>(
	direction: "largest" | "smallest",
	metric: MetricKeys<TGame>,
	name: string,
	applicator: (base: PBScoreDocumentNoRank<TGame>, score: ScoreDocument<TGame>) => void,
): PBMergeFunction<TGame> {
	return async (userID, chartID, asOfTimestamp, base) => {
		let q = DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.innerJoin("song", "song.id", "chart.song_id")
			.leftJoin("import", "import.id", "score.import_id")
			.select(SELECT_SCORE_DOCUMENT)
			.where("score.user_id", "=", userID)
			.where("chart.id", "=", chartID)
			.where(metricIsNumericSql(metric))
			.where(scoreVisibleSql());

		if (asOfTimestamp !== null) {
			q = q.where(
				sql<boolean>`(score.time_achieved IS NOT NULL AND score.time_achieved < ${UnixMillisecondsToISO8601(asOfTimestamp)})`,
			);
		}

		const sortVal = metricSortValueSql(metric);

		const row = await q
			.orderBy(
				direction === "largest"
					? sql`${sortVal} DESC NULLS LAST`
					: sql`${sortVal} ASC NULLS LAST`,
			)
			.orderBy(sql`score.time_achieved ASC NULLS LAST`)
			.limit(1)
			.executeTakeFirst();

		if (row === undefined) {
			return null;
		}

		const bestScoreFor = ToScoreDocument(
			row as ScoreDocumentJoinRow,
		) as unknown as ScoreDocument<TGame>;

		applicator(base, bestScoreFor);

		base.highlight ||= bestScoreFor.highlight;

		if (
			base.timeAchieved !== null &&
			bestScoreFor.timeAchieved !== null &&
			bestScoreFor.timeAchieved > base.timeAchieved
		) {
			base.timeAchieved = bestScoreFor.timeAchieved;
		}

		return {
			name,
			scoreID: bestScoreFor.scoreID,
		};
	};
}
