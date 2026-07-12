import { LoadFolderDocumentByGameAndSlug } from "#lib/db-formats/folders";
import { GetPBOnChart } from "#lib/db-formats/pb";
import DB from "#services/pg/db";
import { GetFolderChartIDs } from "#utils/folder";
import { sql } from "kysely";
import {
	GetGameConfig,
	type integer,
	type PBScoreDocument,
	type ShowcaseStatChart,
	type ShowcaseStatDetails,
	type ShowcaseStatFolder,
	type V3Game,
} from "tachi-common";

export type ShowcaseEvalChartResult = {
	pb: PBScoreDocument | null;
	playcount: number;
};

export type ShowcaseEvalFolderResult = {
	outOf: number;
	value: number;
};

export function EvaluateShowcaseStat(
	game: V3Game,
	details: ShowcaseStatDetails,
	userID: integer,
): Promise<ShowcaseEvalChartResult | ShowcaseEvalFolderResult> {
	switch (details.mode) {
		case "chart":
			return EvaluateShowcaseChartStat(details, userID);
		case "folder":
			return EvaluateShowcaseFolderStat(game, details, userID);

		default:
			// @ts-expect-error This should never happen anyway -- this ignore ignores a 'never' result.
			throw new Error(`Invalid mode of ${details.mode} as details mode?`);
	}
}

async function EvaluateShowcaseChartStat(
	details: ShowcaseStatChart,
	userID: integer,
): Promise<ShowcaseEvalChartResult> {
	const [pb, playcountRow] = await Promise.all([
		GetPBOnChart(userID, details.chartID),
		DB.selectFrom("score")
			.innerJoin("chart", "chart.id", "score.chart_id")
			.select((eb) => eb.fn.countAll<number>().as("cnt"))
			.where("score.user_id", "=", userID)
			.where("chart.id", "=", details.chartID)
			.executeTakeFirst(),
	]);

	return {
		pb,
		playcount: Number(playcountRow?.cnt ?? 0),
	};
}

async function EvaluateShowcaseFolderStat(
	game: V3Game,
	details: ShowcaseStatFolder,
	userID: integer,
): Promise<ShowcaseEvalFolderResult> {
	const folder = await LoadFolderDocumentByGameAndSlug(game, details.slug);

	if (!folder) {
		throw new Error(
			`Showcase folder slug ${JSON.stringify(details.slug)} does not exist for ${game}.`,
		);
	}

	const chartIDs = await GetFolderChartIDs(folder.folderID);

	const value = await CountPbsForFolderMetricGte(
		userID,
		chartIDs,
		game,
		details.metric,
		details.gte,
	);

	return { value, outOf: chartIDs.length };
}

async function CountPbsForFolderMetricGte(
	userID: integer,
	chartIDs: string[],
	game: V3Game,
	metric: string,
	gte: number,
): Promise<number> {
	if (chartIDs.length === 0) {
		return 0;
	}

	const gameConfig = GetGameConfig(game);
	const scoreMetricConfig =
		gameConfig.providedMetrics[metric] ?? gameConfig.derivedMetrics[metric];

	if (!scoreMetricConfig) {
		throw new Error(`Invalid metric of ${metric} passed for game ${game}.`);
	}

	const jsonBlob =
		gameConfig.derivedMetrics[metric] !== undefined ? sql`pb.derived_data` : sql`pb.data`;

	const row = await DB.selectFrom("pb")
		.select(sql<number>`count(*)::int`.as("count"))
		.where("pb.user_id", "=", userID)
		.where("pb.chart_id", "in", chartIDs)
		.where(sql<boolean>`(${jsonBlob}::jsonb->>${sql.lit(metric)})::double precision >= ${gte}`)
		.executeTakeFirst();

	return row?.count ?? 0;
}
