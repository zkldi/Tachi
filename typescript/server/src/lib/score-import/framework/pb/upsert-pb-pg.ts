import type { CalculationRunStartedAt } from "#lib/dirty-queues/calculation-run";
import type { Kysely } from "kysely";
import type { Database } from "tachi-db";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import { mongoScoreDataToPg } from "#lib/v3/migration-tools";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { type PBScoreDocument, type V3Game } from "tachi-common";

export type PBScoreDocumentNoRank<TGame extends V3Game = V3Game> = Omit<
	PBScoreDocument<TGame>,
	"rankingData"
>;

/**
 * Inserts or updates a `pb` row plus `pb_composed_from` for one user/chart (lens = null).
 *
 * Returns whether the row was written. Stale runs (see `last_clean_started_at`) are skipped.
 */
export async function upsertPbFromMongoDoc(
	db: Kysely<Database>,
	pbDoc: PBScoreDocumentNoRank,
	runStartedAt: CalculationRunStartedAt,
): Promise<boolean> {
	const game = pbDoc.game;
	const { data, derived, judgements } = mongoScoreDataToPg(game, pbDoc.scoreData);
	const judgementsJson = JSON.stringify(judgements);
	const ranking = GAME_IMPLEMENTATIONS[game].pbRankingValues(pbDoc as never);

	const calc = { ...(pbDoc.calculatedData as Record<string, unknown>) };
	delete calc.rank;
	delete calc.outOf;
	const calculated = {
		...calc,
		rivalRank: null,
	};

	const existing = await db
		.selectFrom("pb")
		.select("row_id")
		.where("user_id", "=", pbDoc.userID)
		.where("chart_id", "=", pbDoc.chartID)
		.where("lens", "is", null)
		.executeTakeFirst();

	let pbId: string;
	let applied = false;

	if (existing) {
		pbId = existing.row_id;

		const updated = await db
			.updateTable("pb")
			.set({
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: judgementsJson,
				calculated_data: JSON.stringify(calculated),
				ranking_value: ranking.ranking,
				ranking_value_tb1: ranking.tb1,
				ranking_value_tb2: ranking.tb2,
				ranking_value_tb3: ranking.tb3,
				ranking_value_tb4: ranking.tb4,
				ranking_value_tb5: ranking.tb5,
				highlight: pbDoc.highlight,
				time_achieved:
					pbDoc.timeAchieved !== null && pbDoc.timeAchieved !== undefined
						? UnixMillisecondsToISO8601(pbDoc.timeAchieved)
						: null,
				last_clean_started_at: runStartedAt,
			})
			.where("row_id", "=", pbId)
			.where("last_clean_started_at", "<=", runStartedAt)
			.returning("row_id")
			.executeTakeFirst();

		applied = updated !== undefined;
	} else {
		const inserted = await db
			.insertInto("pb")
			.values({
				user_id: pbDoc.userID,
				chart_id: pbDoc.chartID,
				lens: null,
				data: JSON.stringify(data),
				derived_data: JSON.stringify(derived),
				judgements: judgementsJson,
				calculated_data: JSON.stringify(calculated),
				ranking_value: ranking.ranking,
				ranking_value_tb1: ranking.tb1,
				ranking_value_tb2: ranking.tb2,
				ranking_value_tb3: ranking.tb3,
				ranking_value_tb4: ranking.tb4,
				ranking_value_tb5: ranking.tb5,
				highlight: pbDoc.highlight,
				time_achieved:
					pbDoc.timeAchieved !== null && pbDoc.timeAchieved !== undefined
						? UnixMillisecondsToISO8601(pbDoc.timeAchieved)
						: null,
				last_clean_started_at: runStartedAt,
			})
			.returning("row_id")
			.executeTakeFirst();

		if (!inserted) {
			return false;
		}

		pbId = inserted.row_id;
		applied = true;
	}

	if (!applied) {
		return false;
	}

	await db.deleteFrom("pb_composed_from").where("pb_id", "=", pbId).execute();

	if (pbDoc.composedFrom.length > 0) {
		await db
			.insertInto("pb_composed_from")
			.values(
				pbDoc.composedFrom.map((ref) => ({
					pb_id: pbId,
					score_id: ref.scoreID,
					merge_name: ref.name,
				})),
			)
			.execute();
	}

	return true;
}
