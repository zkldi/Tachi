import { type PbDocumentJoinRow, ToPbScoreDocument } from "#lib/db-formats/pb";
import DB from "#services/pg/db";
import { sql } from "kysely";
import {
	type integer,
	type PBScoreDocument,
	type ScoreRatingAlgorithms,
	type V3Game,
} from "tachi-common";

/**
 * Curries a function that returns the sum of N best ratings on `key`.
 *
 * @param key - What rating value to sum.
 * @param n - The amount of rating values to pull.
 * @param returnMean - Optionally, if true, return the sum of these values divided by N.
 * @param nullIfNotEnoughScores - If true, return null if the total scores this user has is less than N.
 * @param multiplier - If defined, ratings will be multiplied by this value and converted to integers.
 *
 * @returns - Number if the user has scores with that rating algorithm, null if they have
 * no scores with this rating algorithm that are non-null.
 */
function CalcN<TGame extends V3Game>(
	key: ScoreRatingAlgorithms[TGame],
	n: integer,
	returnMean = false,
	nullIfNotEnoughScores = false,
	multiplier = 1,
) {
	return async (game: TGame, userID: integer) => {
		const rows = await DB.selectFrom("pb")
			.innerJoin("chart", "chart.id", "pb.chart_id")
			.select("pb.calculated_data")
			.where("pb.user_id", "=", userID)
			.where("chart.game", "=", game)
			.where("chart.is_primary", "=", true)
			.where((eb) =>
				eb(
					sql`jsonb_typeof(pb.calculated_data::jsonb -> ${sql.lit(key)})`,
					"=",
					sql`'number'`,
				),
			)
			.orderBy(sql`(pb.calculated_data::jsonb->>${sql.lit(key)})::double precision`, "desc")
			.limit(n)
			.execute();

		if (rows.length === 0) {
			return null;
		}

		if (nullIfNotEnoughScores && rows.length < n) {
			return null;
		}

		const sc = rows.map((r) => {
			const cd = r.calculated_data as Record<string, number | null | undefined>;
			return cd[key]!;
		});

		if (multiplier !== 1) {
			const result = sc.reduce((a, e) => a + Math.round((e ?? 0) * multiplier), 0);

			if (returnMean) {
				return Math.floor(result / n) / multiplier;
			}

			return result / multiplier;
		}

		let result = sc.reduce((a, e) => a + e, 0);

		if (returnMean) {
			result = result / n;
		}

		return result;
	};
}

export function ProfileSumBestN<TGame extends V3Game>(
	key: ScoreRatingAlgorithms[TGame],
	n: integer,
	nullIfNotEnoughScores = false,
	multiplier = 1,
) {
	return CalcN(key, n, false, nullIfNotEnoughScores, multiplier);
}

export function ProfileAvgBestN<TGame extends V3Game>(
	key: ScoreRatingAlgorithms[TGame],
	n: integer,
	nullIfNotEnoughScores = false,
	multiplier = 1,
) {
	return CalcN(key, n, true, nullIfNotEnoughScores, multiplier);
}

export async function GetBestRatingOnSongs(
	songIDs: Array<integer>,
	userID: integer,
	game: V3Game,
	ratingProp: "skill",
	limit: integer,
): Promise<Array<PBScoreDocument>> {
	if (songIDs.length === 0) {
		return [];
	}

	const rows = await sql<PbDocumentJoinRow>`
		WITH filtered AS (
			SELECT pb.row_id,
				row_number() OVER (
					PARTITION BY chart.song_id
					ORDER BY (pb.calculated_data::jsonb->>${sql.lit(ratingProp)})::double precision DESC NULLS LAST
				) AS rn
			FROM pb
			INNER JOIN chart ON chart.id = pb.chart_id
			INNER JOIN song ON song.id = chart.song_id
			WHERE pb.user_id = ${userID}
				AND chart.game = ${game}
				AND song.id in (${sql.join(songIDs)})
		)
		SELECT
			pb.row_id,
			pb.user_id,
			pb.chart_id,
			pb.lens,
			pb.data,
			pb.derived_data,
			pb.calculated_data,
			pb.judgements,
			pb.ranking_value,
			pb.ranking_value_tb1,
			pb.ranking_value_tb2,
			pb.ranking_value_tb3,
			pb.ranking_value_tb4,
			pb.ranking_value_tb5,
			pb.highlight,
			pb.time_achieved,
			song.id as song_id,
			chart.game as chart_game,
			chart.is_primary as is_primary,
			chart_leaderboard.rank AS leaderboard_rank,
			chart_leaderboard.out_of AS leaderboard_out_of
		FROM pb
		INNER JOIN chart ON chart.id = pb.chart_id
		INNER JOIN song ON song.id = chart.song_id
		INNER JOIN chart_leaderboard ON chart_leaderboard.row_id = pb.row_id
		INNER JOIN filtered f ON f.row_id = pb.row_id AND f.rn = 1
		ORDER BY (pb.calculated_data::jsonb->>${sql.lit(ratingProp)})::double precision DESC NULLS LAST
		LIMIT ${limit}
	`.execute(DB);

	return Promise.all(rows.rows.map((row) => ToPbScoreDocument(row)));
}
