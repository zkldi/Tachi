import {
	type PbDocumentJoinRow,
	SELECT_PB_DOCUMENT_WITH_LEADERBOARD,
	ToPbScoreDocument,
} from "#lib/db-formats/pb";
import DB from "#services/pg/db";
import { type GetScoreMetricConf, type GoalDocument, type PBScoreDocument } from "tachi-common";

type GoalMetricConf = NonNullable<ReturnType<typeof GetScoreMetricConf>>;

/**
 * Loads the user's leaderboard PB row for each chart in `chartPgIds` (Postgres `chart.id`).
 */
export async function LoadPbsForUserOnChartsForGoal(
	userId: number,
	chartIDs: string[],
): Promise<PBScoreDocument[]> {
	if (chartIDs.length === 0) {
		return [];
	}

	const rows = await DB.selectFrom("pb")
		.innerJoin("chart_leaderboard", "chart_leaderboard.row_id", "pb.row_id")
		.innerJoin("chart", "chart.id", "pb.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.select(SELECT_PB_DOCUMENT_WITH_LEADERBOARD)
		.where("pb.user_id", "=", userId)
		.where("chart.id", "in", chartIDs)
		.execute();

	return Promise.all(rows.map((r) => ToPbScoreDocument(r as PbDocumentJoinRow)));
}

export function getGoalMetricValueFromPb(
	pb: PBScoreDocument,
	criteriaKey: GoalDocument["criteria"]["key"],
	scoreConf: GoalMetricConf | null,
): number | null {
	// null scoreConf signals a calculated-data goal — read from pb.calculatedData
	if (scoreConf === null) {
		const v = (pb.calculatedData as Record<string, number | null | undefined>)[
			criteriaKey as string
		];

		return typeof v === "number" ? v : null;
	}

	if (scoreConf.type === "ENUM") {
		const v = pb.scoreData.enumIndexes[criteriaKey as keyof typeof pb.scoreData.enumIndexes];

		return typeof v === "number" ? v : null;
	}

	const v = (pb.scoreData as Record<string, unknown>)[criteriaKey as string];

	return typeof v === "number" ? v : null;
}

export function pbMeetsGoalThreshold(
	pb: PBScoreDocument,
	criteriaKey: GoalDocument["criteria"]["key"],
	threshold: number,
	scoreConf: GoalMetricConf | null,
): boolean {
	const v = getGoalMetricValueFromPb(pb, criteriaKey, scoreConf);

	if (v === null) {
		return false;
	}

	return v >= threshold;
}
