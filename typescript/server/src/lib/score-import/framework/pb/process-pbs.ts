import type { KtLogger } from "#lib/log/log";

import {
	type CalculationRunStartedAt,
	newCalculationRunStartedAt,
} from "#lib/dirty-queues/calculation-run";
import DB from "#services/pg/db";
import { GetChartForIDGuaranteed } from "#utils/db";
import { type integer, type V3Game } from "tachi-common";

import { CreatePBDoc, type PBScoreDocumentNoRank, UpdateChartRanking } from "./create-pb-doc";
import { upsertPbFromMongoDoc } from "./upsert-pb-pg";

export interface ProcessPBsOptions {
	runStartedAt?: CalculationRunStartedAt;
}

/**
 * Process, recalculate and update a users PBs for this set of chartIDs.
 *
 * For charts where the user has no remaining scores, any stale `pb` row (and its
 * `pb_composed_from` entries) is deleted so it does not linger after a revert.
 */
export async function ProcessPBs(
	game: V3Game,
	userID: integer,
	chartIDs: Set<string>,
	log: KtLogger,
	options?: ProcessPBsOptions,
): Promise<void> {
	if (chartIDs.size === 0) {
		return;
	}

	const runStartedAt = options?.runStartedAt ?? (await newCalculationRunStartedAt());

	const chartIDsArray = [...chartIDs];
	const promises = chartIDsArray.map((chartID) =>
		GetChartForIDGuaranteed(chartID).then((chart) => CreatePBDoc(game, userID, chart, log)),
	);

	const pbDocsReturn = await Promise.all(promises);

	const pbDocs: Array<PBScoreDocumentNoRank> = [];
	const emptyChartIDs: Array<string> = [];

	for (let i = 0; i < pbDocsReturn.length; i++) {
		const doc = pbDocsReturn[i];

		if (!doc) {
			// No remaining scores on this chart — the PB row (if any) is stale.
			emptyChartIDs.push(chartIDsArray[i]!);
			continue;
		}

		pbDocs.push(doc);
	}

	// Delete stale PB rows for charts where the user has no remaining scores.
	// pb_composed_from has no ON DELETE CASCADE on the pb_id FK, so clean it up first.
	if (emptyChartIDs.length > 0) {
		const stalePbRows = await DB.selectFrom("pb")
			.select("pb.row_id")
			.where("pb.user_id", "=", userID)
			.where("pb.chart_id", "in", emptyChartIDs)
			.where("pb.lens", "is", null)
			.execute();

		if (stalePbRows.length > 0) {
			const stalePbIds = stalePbRows.map((r) => r.row_id);
			await DB.deleteFrom("pb_composed_from").where("pb_id", "in", stalePbIds).execute();
			await DB.deleteFrom("pb").where("pb.row_id", "in", stalePbIds).execute();
		}
	}

	if (pbDocs.length === 0) {
		return;
	}

	await DB.transaction().execute(async (trx) => {
		// TODO(zk): parallelize?
		for (const doc of pbDocs) {
			await upsertPbFromMongoDoc(trx, doc, runStartedAt);
		}
	});

	await Promise.all(pbDocs.map((doc) => UpdateChartRanking(doc.game, doc.chartID)));
}

/**
 * Re-runs {@link ProcessPBs} for every user who still has scores on any of the given charts
 * (Postgres `score` / `chart` tables). Used after bulk PB removal so rankings stay coherent.
 */
export async function RecalculatePbsForChartsFromPostgresScores(
	game: V3Game,
	chartIDs: ReadonlyArray<string>,
	log: KtLogger,
): Promise<void> {
	if (chartIDs.length === 0) {
		return;
	}

	const rows = await DB.selectFrom("score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.select(["score.user_id", "chart.id"])
		.where("chart.id", "in", [...chartIDs])
		.where("chart.game", "=", game)
		.execute();

	const byUser = new Map<integer, Set<string>>();

	for (const r of rows) {
		let set = byUser.get(r.user_id);

		if (!set) {
			set = new Set();
			byUser.set(r.user_id, set);
		}

		set.add(r.id);
	}

	for (const [uid, cids] of byUser) {
		await ProcessPBs(game, uid, cids, log);
	}
}
