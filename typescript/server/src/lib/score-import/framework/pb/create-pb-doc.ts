import type { KtLogger } from "#lib/log/log";

import { GAME_IMPLEMENTATIONS } from "#game-implementations/game-implementations";
import {
	type ScoreDocumentJoinRow,
	SELECT_SCORE_DOCUMENT,
	ToScoreDocument,
} from "#lib/db-formats/score";
import DB from "#services/pg/db";
import { DeleteUndefinedProps } from "#utils/misc";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import { sql } from "kysely";
import {
	type ChartDocument,
	GetGameConfig,
	type integer,
	type ScoreDocument,
	type V3Game,
} from "tachi-common";

import type { PBScoreDocumentNoRank } from "./upsert-pb-pg";

import { CreateScoreCalcData } from "../calculated-data/score";
import { scoreVisibleSql } from "../pg/score-visibility";
import { CreateEnumIndexes } from "../score-importing/derivers";

export type { PBScoreDocumentNoRank };

function defaultMetricSortValueSql(game: V3Game) {
	const cfg = GetGameConfig(game);
	const key = cfg.defaultMetric;

	if (key in cfg.derivedMetrics) {
		return sql`(score.derived_data::jsonb->>${sql.lit(key)})::double precision`;
	}

	return sql`(score.data::jsonb->>${sql.lit(key)})::double precision`;
}

/**
 * Get the base score from the default metric, and pb merges are applied ontop of this.
 */
async function GetBaseScoreForPB(
	game: V3Game,
	userID: integer,
	chart: ChartDocument,
	asOfTimestamp: number | undefined,
): Promise<ScoreDocument | null> {
	const sortVal = defaultMetricSortValueSql(game);

	let q = DB.selectFrom("raw_score as score")
		.innerJoin("chart", "chart.id", "score.chart_id")
		.innerJoin("song", "song.id", "chart.song_id")
		.leftJoin("import", "import.id", "score.import_id")
		.select(SELECT_SCORE_DOCUMENT)
		.where("score.user_id", "=", userID)
		.where("chart.id", "=", chart.chartID)
		.where(scoreVisibleSql());

	if (asOfTimestamp !== undefined) {
		q = q.where("score.time_achieved", "<", UnixMillisecondsToISO8601(asOfTimestamp));
	}

	const row = await q
		.orderBy(sql`${sortVal} DESC NULLS LAST`)
		.orderBy(sql`score.time_achieved ASC NULLS LAST`)
		.limit(1)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	return ToScoreDocument(row as ScoreDocumentJoinRow);
}

/**
 * Create a PB document for this user on this chart. Optionally, provide an "As Of"
 * timestamp to constrain the generated PB to only one before the provided time.
 */
export async function CreatePBDoc(
	game: V3Game,
	userID: integer,
	chart: ChartDocument,
	log: KtLogger,
	asOfTimestamp?: number,
) {
	const baseBestScore = await GetBaseScoreForPB(game, userID, chart, asOfTimestamp);

	if (!baseBestScore) {
		if (asOfTimestamp !== undefined) {
			return;
		}

		log.warn(
			{
				chartID: chart.chartID,
				userID,
			},
			`User ${userID} has no scores on chart, but a PB was attempted to be created?`,
		);
		return;
	}

	const gptImpl = GAME_IMPLEMENTATIONS[game];

	const pbDoc: PBScoreDocumentNoRank = {
		composedFrom: [
			{
				name: gptImpl.defaultMergeRefName,
				scoreID: baseBestScore.scoreID,
			},
		],
		chartID: baseBestScore.chartID,
		userID,
		songID: baseBestScore.songID,
		highlight: baseBestScore.highlight,
		timeAchieved: baseBestScore.timeAchieved,
		game: baseBestScore.game,
		isPrimary: baseBestScore.isPrimary,
		scoreData: baseBestScore.scoreData,
		calculatedData: baseBestScore.calculatedData,
	};

	for (const mergeFn of gptImpl.pbMergeFunctions) {
		// eslint-disable-next-line no-await-in-loop
		const ref = await mergeFn(
			userID,
			baseBestScore.chartID,
			asOfTimestamp ?? null,
			pbDoc as never,
		);

		if (ref && !pbDoc.composedFrom.map((e) => e.scoreID).includes(ref.scoreID)) {
			pbDoc.composedFrom.push(ref);
		}
	}

	DeleteUndefinedProps(pbDoc.scoreData.optional);

	const { indexes, optionalIndexes } = CreateEnumIndexes(game, pbDoc.scoreData, log);

	pbDoc.scoreData.enumIndexes = indexes;
	pbDoc.scoreData.optional.enumIndexes = optionalIndexes;

	pbDoc.calculatedData = CreateScoreCalcData(pbDoc.scoreData, chart);

	return pbDoc;
}

export async function UpdateChartRanking(_game: V3Game, _chartID: string) {
	// nothing. rivals don't go in calculated data, thanks claude.
}

export { upsertPbFromMongoDoc } from "./upsert-pb-pg";
